import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calcularLiquidacionSistema,
  calcularMRMNH,
  conTopeIndemnizatorio,
  generarHallazgos,
  repositorioParametrosPorDefecto,
  RubroDeclarado,
  Severidad,
  SinRemuneracionesError,
} from '@audit/motor-calculo';
import { Prisma } from '@prisma/client';
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
      include: { empleado: { include: { remuneracionesMensuales: true } }, variables: true },
    });
    if (!caso) throw new NotFoundException(`Caso ${casoId} no encontrado`);

    const liquidacionEmpresa = await this.prisma.liquidacion.findFirst({
      where: { casoId, origen: 'empresa', estado: 'vigente' },
      include: { rubros: { include: { rubro: true } } },
    });
    if (!liquidacionEmpresa) {
      throw new BadRequestException('El caso no tiene una liquidación de la empresa cargada todavía');
    }

    const mrmnh = this.calcularMRMNHDelCaso(
      caso.empleado.remuneracionesMensuales,
      caso.empleado.fechaIngreso,
      caso.fechaExtincion,
    );
    const sueldoBaseIndemnizacion = this.sueldoBaseIndemnizacionDelCaso(
      caso.empleado.remuneracionesMensuales,
      caso.fechaExtincion,
    );
    const variablesCaso = variablesCasoDesde(
      caso,
      caso.empleado,
      caso.variables,
      mrmnh.valor,
      sueldoBaseIndemnizacion,
    );
    const repositorioParametros = await this.repositorioParametrosParaCliente(caso.empleado.clienteId);
    const liquidacionCalculada = calcularLiquidacionSistema(variablesCaso, repositorioParametros);

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

  /**
   * Si el cliente tiene configurado un tope indemnizatorio propio para
   * IND_ANTIGUEDAD (art. 245 LCT), lo aplica sobre el repositorio de parámetros
   * normativos. `calcularIndemnizacionAntiguedad` sigue garantizando el piso del
   * 67% de la MRMNH (doctrina "Vizzoti") sin importar el tope configurado, así
   * que esta personalización nunca puede resultar en un monto inferior al legal.
   */
  private async repositorioParametrosParaCliente(clienteId: string) {
    const config = await this.prisma.configuracionRubroCliente.findFirst({
      where: { clienteId, rubro: { codigo: 'IND_ANTIGUEDAD' } },
    });
    const topeIndemnizatorio = (config?.parametros as { topeIndemnizatorio?: number } | null)?.topeIndemnizatorio;
    if (typeof topeIndemnizatorio !== 'number') return repositorioParametrosPorDefecto;
    return conTopeIndemnizatorio(repositorioParametrosPorDefecto, topeIndemnizatorio);
  }

  /**
   * Deriva la MRMNH (mejor remuneración mensual, normal y habitual — art. 245
   * LCT) del histórico de `RemuneracionMensual` cargado para el empleado (manual
   * o importado en lote, ver `ImportacionesService`), en vez de un único número
   * tipeado a mano. Traduce `SinRemuneracionesError` a un 400 claro para el
   * auditor.
   */
  private calcularMRMNHDelCaso(
    remuneraciones: { periodo: Date; conceptosRemunerativos: Prisma.Decimal; esNormalYHabitual: boolean }[],
    fechaIngreso: Date,
    fechaEgreso: Date,
  ) {
    try {
      return calcularMRMNH(
        remuneraciones.map((r) => ({
          periodo: r.periodo,
          conceptosRemunerativos: Number(r.conceptosRemunerativos),
          esNormalYHabitual: r.esNormalYHabitual,
        })),
        fechaIngreso,
        fechaEgreso,
      );
    } catch (error) {
      if (error instanceof SinRemuneracionesError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /**
   * Base por defecto de "sueldo mensual actual" (vacaciones no gozadas, arts.
   * 150/156 LCT): la `RemuneracionMensual` más reciente hasta el mes de egreso
   * inclusive. Su `conceptosRemunerativos` ya viene filtrado por el catálogo de
   * conceptos del cliente cuando existe (solo los marcados `baseIndemnizacion`,
   * ver ImportacionesService.importarRecibo/importarNomina y docs/motor-calculo.md
   * §2.4) — a diferencia de la MRMNH, acá no importa si el mes es "normal y
   * habitual": es la remuneración vigente al momento de la extinción. `null` si
   * el empleado no tiene ninguna remuneración cargada hasta esa fecha.
   */
  private sueldoBaseIndemnizacionDelCaso(
    remuneraciones: { periodo: Date; conceptosRemunerativos: Prisma.Decimal }[],
    fechaEgreso: Date,
  ): number | null {
    const finDelMesDeEgreso = new Date(Date.UTC(fechaEgreso.getUTCFullYear(), fechaEgreso.getUTCMonth() + 1, 0));
    const masReciente = remuneraciones
      .filter((r) => r.periodo <= finDelMesDeEgreso)
      .sort((a, b) => b.periodo.getTime() - a.periodo.getTime())[0];
    return masReciente ? Number(masReciente.conceptosRemunerativos) : null;
  }
}
