import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calcularControlF931,
  FilaReporteF931,
  parsearReporteF931,
  ReporteF931InvalidoError,
} from '@audit/motor-calculo';
import { ReporteF931Empleado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CargasSocialesService } from '../cargas-sociales/cargas-sociales.service';

/** Los sistemas de liquidación suelen exportar en Windows-1252; si el archivo es UTF-8 válido, se usa UTF-8. */
function decodificar(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

const aPeriodoTexto = (fecha: Date) => fecha.toISOString().slice(0, 7);

@Injectable()
export class NominaMensualService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cargasSociales: CargasSocialesService,
  ) {}

  async listarReportes(clienteId: string) {
    await this.asegurarCliente(clienteId);
    const reportes = await this.prisma.reporteF931.findMany({
      where: { clienteId },
      orderBy: { periodo: 'desc' },
      include: { _count: { select: { empleados: true } } },
    });
    return reportes.map((r) => ({
      periodo: aPeriodoTexto(r.periodo),
      nombreArchivo: r.nombreArchivo,
      importadoEl: r.createdAt,
      cantidadEmpleados: r._count.empleados,
    }));
  }

  /** Guarda un reporte por período; si el período ya estaba importado, lo reemplaza. */
  async importarReporte(clienteId: string, nombreArchivo: string, buffer: Buffer) {
    await this.asegurarCliente(clienteId);
    let lectura: ReturnType<typeof parsearReporteF931>;
    try {
      lectura = parsearReporteF931(decodificar(buffer));
    } catch (error) {
      if (error instanceof ReporteF931InvalidoError) throw new BadRequestException(error.message);
      throw error;
    }
    if (lectura.filas.length === 0) {
      throw new BadRequestException(['El reporte no tiene empleados válidos.', ...lectura.errores].join(' '));
    }

    const advertencias: string[] = [];
    const porPeriodo = new Map<string, FilaReporteF931[]>();
    for (const fila of lectura.filas) {
      const clave = aPeriodoTexto(fila.periodo);
      const filas = porPeriodo.get(clave) ?? [];
      if (filas.some((f) => f.cuil === fila.cuil)) {
        advertencias.push(`El CUIL ${fila.cuil} (${fila.nombre}) aparece más de una vez en ${clave}: se tomó el primero.`);
        continue;
      }
      filas.push(fila);
      porPeriodo.set(clave, filas);
    }

    const periodos: { periodo: string; cantidadEmpleados: number; reemplazado: boolean }[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const [periodo, filas] of porPeriodo) {
        const fecha = filas[0].periodo;
        const anterior = await tx.reporteF931.findUnique({ where: { clienteId_periodo: { clienteId, periodo: fecha } } });
        if (anterior) await tx.reporteF931.delete({ where: { id: anterior.id } });
        await tx.reporteF931.create({
          data: {
            clienteId,
            periodo: fecha,
            nombreArchivo,
            empleados: {
              create: filas.map(({ periodo: _p, montoDetraerSAC, ...resto }) => ({ ...resto, montoDetraerSac: montoDetraerSAC })),
            },
          },
        });
        periodos.push({ periodo, cantidadEmpleados: filas.length, reemplazado: Boolean(anterior) });
      }
    });

    return { periodos, errores: lectura.errores, advertencias };
  }

  async controlDeLeyes(clienteId: string, periodo: string) {
    await this.asegurarCliente(clienteId);
    const reporte = await this.prisma.reporteF931.findUnique({
      where: { clienteId_periodo: { clienteId, periodo: new Date(`${periodo}-01T00:00:00Z`) } },
      include: { empleados: { orderBy: { nombre: 'asc' } } },
    });
    if (!reporte) throw new NotFoundException(`No hay reporte F.931 importado para ${periodo}`);

    const { configurado, configuracion } = await this.cargasSociales.obtener(clienteId);
    if (!configurado) {
      return { periodo, nombreArchivo: reporte.nombreArchivo, cargasSocialesConfiguradas: false, control: null };
    }
    return {
      periodo,
      nombreArchivo: reporte.nombreArchivo,
      cargasSocialesConfiguradas: true,
      control: calcularControlF931(configuracion, reporte.empleados.map((e) => this.aFila(e, reporte.periodo))),
    };
  }

  private aFila(e: ReporteF931Empleado, periodo: Date): FilaReporteF931 {
    return {
      periodo,
      legajo: e.legajo,
      nombre: e.nombre,
      cuil: e.cuil,
      modalidadContratacion: e.modalidadContratacion,
      condicion: e.condicion,
      convenio: e.convenio,
      remuneracionTotal: Number(e.remuneracionTotal),
      remuneracion1: Number(e.remuneracion1),
      remuneracion2: Number(e.remuneracion2),
      remuneracion3: Number(e.remuneracion3),
      remuneracion4: Number(e.remuneracion4),
      remuneracion5: Number(e.remuneracion5),
      remuneracion8: Number(e.remuneracion8),
      remuneracion9: Number(e.remuneracion9),
      remuneracion10: Number(e.remuneracion10),
      montoDetraer: Number(e.montoDetraer),
      montoDetraerSAC: Number(e.montoDetraerSac),
      totalDetraer: Number(e.totalDetraer),
    };
  }

  private async asegurarCliente(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
  }
}
