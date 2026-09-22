import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

/** Columnas que debe tener la hoja de nómina a importar — ver docs/motor-calculo.md §2.2. */
const COLUMNAS_REQUERIDAS = [
  'Doc',
  'Apellido y Nombre',
  'Período',
  'Ingreso',
  'Categoría',
  'Proceso',
  'Concepto',
  'Monto',
  'TIPO',
] as const;

export interface FilaNominaImportada {
  cuil: string;
  nombre: string;
  periodo: Date;
  fechaIngreso: Date;
  categoria: string | null;
  proceso: string;
  concepto: string;
  monto: number;
  /** 'REMU' | 'NO REMU', tal como viene en el archivo (normalizado a mayúsculas/trim). */
  tipo: string;
}

function normalizarCuil(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Excel puede entregar una fecha como objeto `Date` (si la celda tiene formato
 * de fecha) o como número de serie (días desde el 30/12/1899) si no lo tiene. */
function aFecha(valor: ExcelJS.CellValue, columna: string, fila: number): Date {
  if (valor instanceof Date) return valor;
  if (typeof valor === 'number') {
    // Sistema de fechas 1900 de Excel (con el conocido offset del "29/2/1900" inexistente).
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + valor * 86_400_000);
  }
  throw new BadRequestException(`Fila ${fila}: la columna "${columna}" no tiene una fecha válida`);
}

function aPrimerDiaDelMes(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

function textoDeCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object' && 'text' in (valor as object)) return String((valor as { text: unknown }).text ?? '');
  return String(valor);
}

/**
 * Parsea el archivo de nómina (xlsx) con la estructura de "Remu + NR": un
 * renglón por concepto liquidado, por empleado y período — ver
 * docs/motor-calculo.md §2.2. Valida que estén las columnas requeridas y
 * descarta silenciosamente filas sin CUIL, período o monto (encabezados
 * repetidos, filas en blanco).
 */
export async function parsearNomina(buffer: Buffer): Promise<FilaNominaImportada[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    // Cast: los tipos de exceljs no siguen el lib.dom.d.ts de Buffer usado por
    // esta versión de Node/TS, aunque el valor en tiempo de ejecución es válido.
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException('No se pudo leer el archivo: ¿es un .xlsx válido?');
  }

  const hoja = workbook.worksheets[0];
  if (!hoja) throw new BadRequestException('El archivo no tiene ninguna hoja con datos');

  const columnaPorNombre = new Map<string, number>();
  hoja.getRow(1).eachCell((cell, colNumber) => {
    const texto = textoDeCelda(cell.value).trim();
    if (texto) columnaPorNombre.set(texto, colNumber);
  });

  const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !columnaPorNombre.has(c));
  if (faltantes.length > 0) {
    throw new BadRequestException(
      `El archivo no tiene la estructura esperada; faltan las columnas: ${faltantes.join(', ')}`,
    );
  }

  const columna = (nombre: (typeof COLUMNAS_REQUERIDAS)[number]) => columnaPorNombre.get(nombre)!;
  const filas: FilaNominaImportada[] = [];

  hoja.eachRow({ includeEmpty: false }, (row, numeroFila) => {
    if (numeroFila === 1) return;

    const doc = textoDeCelda(row.getCell(columna('Doc')).value).trim();
    const periodoValor = row.getCell(columna('Período')).value;
    const montoValor = row.getCell(columna('Monto')).value;
    if (!doc || !periodoValor || montoValor === null || montoValor === undefined) return;

    filas.push({
      cuil: normalizarCuil(doc),
      nombre: textoDeCelda(row.getCell(columna('Apellido y Nombre')).value).trim(),
      periodo: aPrimerDiaDelMes(aFecha(periodoValor, 'Período', numeroFila)),
      fechaIngreso: aFecha(row.getCell(columna('Ingreso')).value, 'Ingreso', numeroFila),
      categoria: textoDeCelda(row.getCell(columna('Categoría')).value).trim() || null,
      proceso: textoDeCelda(row.getCell(columna('Proceso')).value),
      concepto: textoDeCelda(row.getCell(columna('Concepto')).value),
      monto: Number(montoValor),
      tipo: textoDeCelda(row.getCell(columna('TIPO')).value).trim().toUpperCase(),
    });
  });

  return filas;
}
