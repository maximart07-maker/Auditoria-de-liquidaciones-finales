import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calcularControlF931,
  cruzarConDDJJ,
  FilaNominaDDJJ,
  FilaReporteF931,
  NominaDDJJInvalidaError,
  parsearNominaDDJJ,
  parsearReporteF931,
  ReporteF931InvalidoError,
} from '@audit/motor-calculo';
import { Prisma, ReporteF931Empleado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DatosInformeControlLeyes } from './informe-control-leyes';
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

  async listarNominasDDJJ(clienteId: string) {
    await this.asegurarCliente(clienteId);
    const nominas = await this.prisma.nominaDDJJ.findMany({
      where: { clienteId },
      orderBy: { periodo: 'desc' },
      include: { _count: { select: { empleados: true } } },
    });
    return nominas.map((n) => ({
      periodo: aPeriodoTexto(n.periodo),
      nombreArchivo: n.nombreArchivo,
      secuencia: n.secuencia,
      importadoEl: n.createdAt,
      cantidadEmpleados: n._count.empleados,
    }));
  }

  /** Guarda la nómina de Declaración en Línea de un período; si ya estaba importada, la reemplaza. */
  async importarNominaDDJJ(clienteId: string, nombreArchivo: string, buffer: Buffer) {
    const cliente = await this.asegurarCliente(clienteId);
    let nomina: ReturnType<typeof parsearNominaDDJJ>;
    try {
      nomina = parsearNominaDDJJ(decodificar(buffer));
    } catch (error) {
      if (error instanceof NominaDDJJInvalidaError) throw new BadRequestException(error.message);
      throw error;
    }
    if (nomina.filas.length === 0) {
      throw new BadRequestException(['La nómina no tiene empleados válidos.', ...nomina.errores].join(' '));
    }
    const cuitCliente = cliente.cuit.replace(/\D/g, '');
    if (nomina.cuit && nomina.cuit !== cuitCliente) {
      throw new BadRequestException(
        `La nómina es del CUIT ${nomina.cuit} (${nomina.contribuyente ?? 'sin nombre'}) y el cliente tiene CUIT ${cuitCliente}.`,
      );
    }

    const advertencias: string[] = [];
    const filas = new Map<string, FilaNominaDDJJ>();
    for (const fila of nomina.filas) {
      if (filas.has(fila.cuil)) {
        advertencias.push(`El CUIL ${fila.cuil} (${fila.nombre}) aparece más de una vez: se tomó el primero.`);
        continue;
      }
      filas.set(fila.cuil, fila);
    }

    let reemplazado = false;
    await this.prisma.$transaction(async (tx) => {
      const anterior = await tx.nominaDDJJ.findUnique({ where: { clienteId_periodo: { clienteId, periodo: nomina.periodo } } });
      if (anterior) {
        reemplazado = true;
        await tx.nominaDDJJ.delete({ where: { id: anterior.id } });
      }
      await tx.nominaDDJJ.create({
        data: {
          clienteId,
          periodo: nomina.periodo,
          cuit: nomina.cuit,
          secuencia: nomina.secuencia,
          nombreArchivo,
          empleados: {
            create: [...filas.values()].map((f) => ({
              cuil: f.cuil,
              nombre: f.nombre,
              datos: f as unknown as Prisma.InputJsonValue,
            })),
          },
        },
      });
    });

    return {
      periodos: [{ periodo: aPeriodoTexto(nomina.periodo), cantidadEmpleados: filas.size, reemplazado }],
      errores: nomina.errores,
      advertencias,
    };
  }

  /** Informe del panel de un período, para descargar en PDF o CSV. */
  async informeControlDeLeyes(clienteId: string, periodo: string): Promise<DatosInformeControlLeyes> {
    const cliente = await this.asegurarCliente(clienteId);
    const datos = await this.controlDeLeyes(clienteId, periodo);
    if (!datos.control) {
      throw new BadRequestException('Para emitir el informe hace falta configurar las cargas sociales del cliente.');
    }
    return {
      cliente: { razonSocial: cliente.razonSocial, cuit: cliente.cuit },
      periodo,
      nombreArchivoReporte: datos.nombreArchivo,
      ddjj: datos.ddjj,
      control: datos.control,
      cruce: datos.cruce,
      emitido: new Date(),
    };
  }

  async controlDeLeyes(clienteId: string, periodo: string) {
    await this.asegurarCliente(clienteId);
    const reporte = await this.prisma.reporteF931.findUnique({
      where: { clienteId_periodo: { clienteId, periodo: new Date(`${periodo}-01T00:00:00Z`) } },
      include: { empleados: { orderBy: { nombre: 'asc' } } },
    });
    if (!reporte) throw new NotFoundException(`No hay reporte F.931 importado para ${periodo}`);

    const nominaDDJJ = await this.prisma.nominaDDJJ.findUnique({
      where: { clienteId_periodo: { clienteId, periodo: reporte.periodo } },
      include: { empleados: true },
    });
    const ddjj = nominaDDJJ
      ? { nombreArchivo: nominaDDJJ.nombreArchivo, secuencia: nominaDDJJ.secuencia, cantidadEmpleados: nominaDDJJ.empleados.length }
      : null;

    const { configurado, configuracion } = await this.cargasSociales.obtener(clienteId);
    if (!configurado) {
      return { periodo, nombreArchivo: reporte.nombreArchivo, cargasSocialesConfiguradas: false, control: null, ddjj, cruce: null };
    }
    const filas = reporte.empleados.map((e) => this.aFila(e, reporte.periodo));
    const control = calcularControlF931(configuracion, filas);
    const cruce = nominaDDJJ
      ? cruzarConDDJJ(filas, control, nominaDDJJ.empleados.map((e) => e.datos as unknown as FilaNominaDDJJ))
      : null;
    return { periodo, nombreArchivo: reporte.nombreArchivo, cargasSocialesConfiguradas: true, control, ddjj, cruce };
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

  private async asegurarCliente(clienteId: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
    return cliente;
  }
}
