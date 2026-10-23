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
  'Código',
  'Concepto',
  'Monto',
  'TIPO',
] as const;

export interface FilaNominaImportada {
  cuil: string;
  nombre: string;
  periodo: Date;
  /** Mes de devengamiento al que se imputa el concepto (primer día del mes), si
   * el archivo trae la columna de imputación y la celda no está vacía — p.ej. un
   * retroactivo liquidado en `periodo` pero devengado en un mes anterior. */
  periodoImputacion: Date | null;
  fechaIngreso: Date;
  categoria: string | null;
  proceso: string;
  /** Código de concepto del sistema de nómina del cliente — ver ConceptoCliente
   * (docs/motor-calculo.md §2.4), usado para saber si computa para la MRMNH. */
  codigo: string;
  concepto: string;
  monto: number;
  /** 'REMU' | 'NO REMU', tal como viene en el archivo (normalizado a mayúsculas/trim).
   * Fallback cuando el cliente no tiene cargado su catálogo de conceptos. */
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

/** Las celdas con fórmula (p.ej. una imputación `=C2` que copia el Período)
 * llegan como `{ formula, result }` o `{ sharedFormula, result }`: se usa el
 * resultado ya calculado que guardó Excel. */
function resultadoDeCelda(valor: ExcelJS.CellValue): ExcelJS.CellValue {
  if (valor && typeof valor === 'object' && !(valor instanceof Date) && 'result' in valor) {
    return (valor as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue;
  }
  return valor;
}

function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '');
}

function mesValido(anio: number, mes: number): Date | null {
  if (mes < 1 || mes > 12 || anio < 1900 || anio > 2999) return null;
  return new Date(Date.UTC(anio, mes - 1, 1));
}

/** La imputación puede venir como fecha, como número de serie de Excel, como
 * número AAAAMM (p.ej. 202605) o como texto (MM/AAAA, AAAA-MM, AAAAMM o
 * DD/MM/AAAA, según el export del sistema de nómina). Celda vacía = sin
 * imputación (el concepto se devenga en el `Período` de la fila). */
function aPeriodoImputacion(valor: ExcelJS.CellValue, fila: number): Date | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return aPrimerDiaDelMes(valor);
  if (typeof valor === 'number' && Number.isInteger(valor) && valor >= 190001 && valor <= 299912) {
    const periodo = mesValido(Math.floor(valor / 100), valor % 100);
    if (periodo) return periodo;
  }
  if (typeof valor === 'number') return aPrimerDiaDelMes(aFecha(valor, 'Imputación', fila));

  const texto = textoDeCelda(valor).trim();
  if (!texto) return null;
  let m = /^(\d{1,2})[/-](\d{4})$/.exec(texto);
  let periodo = m ? mesValido(Number(m[2]), Number(m[1])) : null;
  if (!periodo && (m = /^(\d{4})[/-]?(\d{1,2})$/.exec(texto))) periodo = mesValido(Number(m[1]), Number(m[2]));
  if (!periodo && (m = /^\d{1,2}[/-](\d{1,2})[/-](\d{4})$/.exec(texto))) periodo = mesValido(Number(m[2]), Number(m[1]));
  if (!periodo) {
    throw new BadRequestException(
      `Fila ${fila}: la columna "Imputación" no tiene un mes reconocible ("${texto}") — se espera MM/AAAA, AAAA-MM o una fecha`,
    );
  }
  return periodo;
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
  // Opcional: los exports que no la traen se siguen importando como antes.
  const columnaImputacion = [...columnaPorNombre].find(([nombre]) =>
    sinAcentos(nombre).toLowerCase().includes('imputacion'),
  )?.[1];
  const filas: FilaNominaImportada[] = [];

  hoja.eachRow({ includeEmpty: false }, (row, numeroFila) => {
    if (numeroFila === 1) return;

    const valor = (numeroColumna: number) => resultadoDeCelda(row.getCell(numeroColumna).value);
    const doc = textoDeCelda(valor(columna('Doc'))).trim();
    const periodoValor = valor(columna('Período'));
    const montoValor = valor(columna('Monto'));
    if (!doc || !periodoValor || montoValor === null || montoValor === undefined) return;

    filas.push({
      cuil: normalizarCuil(doc),
      nombre: textoDeCelda(valor(columna('Apellido y Nombre'))).trim(),
      periodo: aPrimerDiaDelMes(aFecha(periodoValor, 'Período', numeroFila)),
      periodoImputacion:
        columnaImputacion === undefined ? null : aPeriodoImputacion(valor(columnaImputacion), numeroFila),
      fechaIngreso: aFecha(valor(columna('Ingreso')), 'Ingreso', numeroFila),
      categoria: textoDeCelda(valor(columna('Categoría'))).trim() || null,
      proceso: textoDeCelda(valor(columna('Proceso'))),
      codigo: textoDeCelda(valor(columna('Código'))).trim(),
      concepto: textoDeCelda(valor(columna('Concepto'))),
      monto: Number(montoValor),
      tipo: textoDeCelda(valor(columna('TIPO'))).trim().toUpperCase(),
    });
  });

  return filas;
}
