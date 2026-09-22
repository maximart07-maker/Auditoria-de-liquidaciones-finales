import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilaNominaImportada, parsearNomina } from './nomina-importada.parser';

interface MesAgregado {
  conceptosRemunerativos: number;
  conceptosNoRemunerativos: number;
  detalleConceptos: { concepto: string; monto: number; tipo: string }[];
  /** true si algún renglón del mes viene de un proceso de "ajuste" (retroactivo) —
   * ver ResumenImportacion.esNormalYHabitual más abajo. */
  tieneAjuste: boolean;
}

interface DatosEmpleado {
  nombre: string;
  fechaIngreso: Date;
  categoria: string | null;
  meses: Map<string, MesAgregado>;
}

export interface ResumenImportacion {
  filasProcesadas: number;
  empleadosDetectados: number;
  empleadosCreados: number;
  empleadosActualizados: number;
  mesesImportados: number;
  errores: string[];
}

@Injectable()
export class ImportacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async importarNomina(clienteId: string, buffer: Buffer): Promise<ResumenImportacion> {
    await this.asegurarCliente(clienteId);
    const filas = await parsearNomina(buffer);
    if (filas.length === 0) {
      throw new BadRequestException('El archivo no tiene filas de datos para importar');
    }

    const porCuil = this.agruparPorEmpleadoYPeriodo(filas);

    let empleadosCreados = 0;
    let empleadosActualizados = 0;
    let mesesImportados = 0;
    const errores: string[] = [];

    for (const [cuil, datos] of porCuil) {
      try {
        const empleadoId = await this.obtenerOCrearEmpleado(clienteId, cuil, datos, (creado) => {
          if (creado) empleadosCreados++;
          else empleadosActualizados++;
        });

        for (const [periodoIso, agregado] of datos.meses) {
          await this.prisma.remuneracionMensual.upsert({
            where: { empleadoId_periodo: { empleadoId, periodo: new Date(periodoIso) } },
            create: {
              empleadoId,
              periodo: new Date(periodoIso),
              conceptosRemunerativos: agregado.conceptosRemunerativos,
              esNormalYHabitual: !agregado.tieneAjuste,
              detalle: { conceptos: agregado.detalleConceptos, conceptosNoRemunerativos: agregado.conceptosNoRemunerativos },
              fuente: 'importado',
            },
            update: {
              conceptosRemunerativos: agregado.conceptosRemunerativos,
              esNormalYHabitual: !agregado.tieneAjuste,
              detalle: { conceptos: agregado.detalleConceptos, conceptosNoRemunerativos: agregado.conceptosNoRemunerativos },
              fuente: 'importado',
            },
          });
          mesesImportados++;
        }
      } catch (error) {
        errores.push(`CUIL ${cuil}: ${(error as Error).message}`);
      }
    }

    return {
      filasProcesadas: filas.length,
      empleadosDetectados: porCuil.size,
      empleadosCreados,
      empleadosActualizados,
      mesesImportados,
      errores,
    };
  }

  /**
   * Agrupa las filas sueltas (un renglón por concepto) en un agregado por
   * empleado (CUIL) y período: suma `Monto` en `conceptosRemunerativos` cuando
   * `TIPO='REMU'`, y en `conceptosNoRemunerativos` en cualquier otro caso.
   * Marca `tieneAjuste=true` si algún renglón del mes viene de un proceso de
   * liquidación cuyo nombre contiene "ajuste" (heurística: un ajuste/retroactivo
   * suele distorsionar el mes y no debería competir por ser la "mejor"
   * remuneración — el auditor puede revisar y corregir el flag a mano después).
   */
  private agruparPorEmpleadoYPeriodo(filas: FilaNominaImportada[]): Map<string, DatosEmpleado> {
    const porCuil = new Map<string, DatosEmpleado>();

    for (const fila of filas) {
      let datosEmpleado = porCuil.get(fila.cuil);
      if (!datosEmpleado) {
        datosEmpleado = { nombre: fila.nombre, fechaIngreso: fila.fechaIngreso, categoria: fila.categoria, meses: new Map() };
        porCuil.set(fila.cuil, datosEmpleado);
      }

      const periodoIso = fila.periodo.toISOString().slice(0, 10);
      let agregado = datosEmpleado.meses.get(periodoIso);
      if (!agregado) {
        agregado = { conceptosRemunerativos: 0, conceptosNoRemunerativos: 0, detalleConceptos: [], tieneAjuste: false };
        datosEmpleado.meses.set(periodoIso, agregado);
      }

      if (fila.tipo === 'REMU') agregado.conceptosRemunerativos += fila.monto;
      else agregado.conceptosNoRemunerativos += fila.monto;
      agregado.detalleConceptos.push({ concepto: fila.concepto, monto: fila.monto, tipo: fila.tipo });
      if (/ajuste/i.test(fila.proceso)) agregado.tieneAjuste = true;
    }

    return porCuil;
  }

  /** Busca el `Empleado` por CUIL dentro del cliente; si no existe, lo da de
   * alta con los datos del archivo (nombre, fecha de ingreso, categoría). */
  private async obtenerOCrearEmpleado(
    clienteId: string,
    cuil: string,
    datos: DatosEmpleado,
    reportarCreado: (creado: boolean) => void,
  ): Promise<string> {
    const existente = await this.prisma.empleado.findUnique({ where: { clienteId_cuil: { clienteId, cuil } } });
    if (existente) {
      reportarCreado(false);
      return existente.id;
    }

    const creado = await this.prisma.empleado.create({
      data: {
        clienteId,
        cuil,
        nombre: datos.nombre,
        fechaIngreso: datos.fechaIngreso,
        categoria: datos.categoria,
      },
    });
    reportarCreado(true);
    return creado.id;
  }

  private async asegurarCliente(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
  }
}
