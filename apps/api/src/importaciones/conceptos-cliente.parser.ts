import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export type TipoConceptoNomina = 'remunerativo' | 'no_remunerativo' | 'descuento';
export type CaracteristicaConcepto = 'fijo' | 'variable' | null;

export interface ConceptoClienteImportado {
  codigo: string;
  descripcion: string;
  tipo: TipoConceptoNomina;
  caracteristica: CaracteristicaConcepto;
  baseIndemnizacion: boolean;
}

const COLUMNAS_REQUERIDAS = ['Código', 'Descripción', 'Tipo', 'Característica', 'Base Indemnización'] as const;

/** Normaliza el código de concepto para que matchee entre el catálogo, el
 * export de nómina y el recibo en PDF (que lo trae con ceros a la izquierda,
 * p.ej. "01100" vs "1100") — se compara como número, no como texto. */
export function normalizarCodigoConcepto(valor: string | number): string {
  return String(Number(String(valor).trim()));
}

function textoDeCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object' && 'text' in (valor as object)) return String((valor as { text: unknown }).text ?? '');
  return String(valor);
}

function aTipo(valor: string): TipoConceptoNomina {
  const normalizado = valor.trim().toLowerCase();
  if (normalizado.startsWith('no remunerat')) return 'no_remunerativo';
  if (normalizado.startsWith('descuento')) return 'descuento';
  if (normalizado.startsWith('remunerat')) return 'remunerativo';
  throw new BadRequestException(`Tipo de concepto no reconocido: "${valor}" (esperado Remunerativo, No remunerativo o Descuento)`);
}

function aCaracteristica(valor: string): CaracteristicaConcepto {
  const normalizado = valor.trim().toLowerCase();
  if (normalizado === 'fijo') return 'fijo';
  if (normalizado === 'variable') return 'variable';
  return null; // "N/A" u otro valor sin equivalente
}

function aBooleanoSiNo(valor: string): boolean {
  return valor.trim().toLowerCase() === 'si' || valor.trim().toLowerCase() === 'sí';
}

/**
 * Parsea el catálogo de conceptos propio del cliente (xlsx, hoja "Conceptos"):
 * Código, Descripción, Tipo, Característica, Base Indemnización — ver
 * docs/motor-calculo.md §2.4.
 */
export async function parsearConceptosCliente(buffer: Buffer): Promise<ConceptoClienteImportado[]> {
  const workbook = new ExcelJS.Workbook();
  try {
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
  const conceptos: ConceptoClienteImportado[] = [];

  hoja.eachRow({ includeEmpty: false }, (row, numeroFila) => {
    if (numeroFila === 1) return;
    const codigoValor = row.getCell(columna('Código')).value;
    const descripcion = textoDeCelda(row.getCell(columna('Descripción')).value).trim();
    if (codigoValor === null || codigoValor === undefined || !descripcion) return;

    conceptos.push({
      codigo: normalizarCodigoConcepto(codigoValor as string | number),
      descripcion,
      tipo: aTipo(textoDeCelda(row.getCell(columna('Tipo')).value)),
      caracteristica: aCaracteristica(textoDeCelda(row.getCell(columna('Característica')).value)),
      baseIndemnizacion: aBooleanoSiNo(textoDeCelda(row.getCell(columna('Base Indemnización')).value)),
    });
  });

  if (conceptos.length === 0) {
    throw new BadRequestException('El archivo no tiene filas de conceptos para importar');
  }
  return conceptos;
}
