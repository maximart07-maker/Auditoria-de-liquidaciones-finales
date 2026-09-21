import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { calcularLiquidacionSistema, generarHallazgos, RubroDeclarado, Severidad } from '@audit/motor-calculo';
import { PrismaService } from '../prisma/prisma.service';
import { variablesCasoDesde } from './variables-caso.mapper';

@Injectable()
export class AuditoriasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ejecuta el motor de cálculo sobre las variables vigentes del caso, guarda la
   * `Liquidacion` de origen "sistema" resultante y genera los `Hallazgo` comparando
   * contra la última `Liquidacion` de origen "empresa" (ver docs/motor-calculo.md §5-6).
   */
  async ejecutar(casoId: string, usuarioId?: string) {
    const caso = await this.prisma.caso.findUnique({
      where: { id: casoId },
      include: { empleado: true, variables: true },
    });
    if (!caso) throw new NotFoundException(`Caso ${casoId} no encontrado`);

    const liquidacionEmpresa = await this.prisma.liquidacion.findFirst({
      where: { casoId, origen: 'empresa', estado: 'vigente' },
      include: { rubros: { include: { rubro: true } } },
    });
    if (!liquidacionEmpresa) {
      throw new BadRequestException('El caso no tiene una liquidación de la empresa cargada todavía');
    }

    const variablesCaso = variablesCasoDesde(caso, caso.empleado, caso.variables);
    const liquidacionCalculada = calcularLiquidacionSistema(variablesCaso);

    const rubrosDeclarados: RubroDeclarado[] = liquidacionEmpresa.rubros.map((r) => ({
      rubro: r.rubro.codigo as RubroDeclarado['rubro'],
      monto: Number(r.monto),
    }));

    // Se necesita el id de todo rubro que aparezca en la liquidación calculada
    // o en la declarada (un hallazgo puede surgir de un rubro que la empresa
    // declaró pero el sistema no calculó, o viceversa).
    const codigosRelevantes = new Set([
      ...liquidacionCalculada.rubros.map((r) => r.rubro),
      ...rubrosDeclarados.map((r) => r.rubro),
    ]);
    const rubrosDb = await this.prisma.rubro.findMany({ where: { codigo: { in: Array.from(codigosRelevantes) } } });
    const rubroIdPorCodigo = new Map(rubrosDb.map((r) => [r.codigo, r.id]));

    const hallazgos = generarHallazgos(rubrosDeclarados, liquidacionCalculada);
    const estadoAuditoria = hallazgos.every((h) => h.severidad === 'baja') ? 'ok' : 'con_diferencias';

    await this.prisma.liquidacion.updateMany({
      where: { casoId, origen: 'sistema', estado: 'vigente' },
      data: { estado: 'reemplazada' },
    });
    const versionSistema = (await this.prisma.liquidacion.count({ where: { casoId, origen: 'sistema' } })) + 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.liquidacion.create({
        data: {
          casoId,
          origen: 'sistema',
          version: versionSistema,
          fechaLiquidacion: liquidacionCalculada.fechaCalculo,
          rubros: {
            create: liquidacionCalculada.rubros.map((r) => ({
              rubroId: rubroIdPorCodigo.get(r.rubro)!,
              monto: r.monto,
              detalleCalculo: r.detalle as object,
            })),
          },
        },
      });

      const auditoria = await tx.auditoria.create({
        data: {
          casoId,
          usuarioId,
          estado: estadoAuditoria,
          resumen: `${hallazgos.length} rubro(s) comparado(s), ${hallazgos.filter((h) => h.severidad !== 'baja').length} con diferencia relevante.`,
          hallazgos: {
            create: hallazgos.map((h) => ({
              rubroId: this.rubroIdRequerido(rubroIdPorCodigo, h.rubro),
              montoDeclarado: h.montoDeclarado,
              montoCalculado: h.montoCalculado,
              porcentajeDiferencia: h.porcentajeDiferencia,
              severidad: h.severidad as Severidad,
            })),
          },
        },
        include: { hallazgos: { include: { rubro: true } } },
      });

      await tx.caso.update({ where: { id: casoId }, data: { estado: 'en_revision' } });

      return auditoria;
    });
  }

  private rubroIdRequerido(mapa: Map<string, string>, codigo: string): string {
    const id = mapa.get(codigo);
    if (!id) throw new BadRequestException(`Rubro "${codigo}" no está cargado en el catálogo (¿faltó correr el seed?)`);
    return id;
  }
}
