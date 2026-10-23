import { BadRequestException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

export interface ConceptoRecibo {
  codigo: string;
  concepto: string;
  unidad: number | null;
  monto: number;
}

export interface ReciboLiquidacionParseado {
  empresaNombre: string | null;
  empresaCuit: string | null;
  cuil: string;
  nombre: string;
  categoria: string | null;
  fechaIngreso: Date;
  /** Primer día del mes/año que figura en el encabezado del recibo (columna "M"/"Año"). */
  periodo: Date;
  conceptos: ConceptoRecibo[];
  remunerativo: number;
  /** true si el recibo trae algún concepto que indica un mes parcial/atípico
   * (días no trabajados, descuento por ingreso/egreso) — típico de la
   * liquidación final, y señal de que no debe competir por ser la MRMNH. */
  esPeriodoAtipico: boolean;
}

function normalizarCuil(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** "1.428.000,00" / "-81.812,50" -> -81812.5 (formato numérico argentino). */
function aNumeroAr(valor: string): number {
  return Number(valor.replace(/\./g, '').replace(',', '.'));
}

function aFecha(dia: string, mes: string, anio: string): Date {
  return new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
}

const REGEX_CONCEPTO = /^(\d{4,6})\s*-\s*(.+?)(-?[\d.]+,\d{2})\s*$/;
const REGEX_UNIDAD_AL_FINAL = /^(.*?)([\d.]+,\d{2})$/;

const CONCEPTOS_ANOMALOS = /dias?\/horas no trabaj|descuento dias? ingreso|ingreso\/?egreso/i;

/**
 * Parsea el recibo de sueldo (PDF, un renglón por concepto) que emite el
 * sistema de liquidación de nómina — ver docs/motor-calculo.md §2.3. El
 * formato de campos es fijo por proveedor (los códigos de concepto no son
 * estándar), así que el mapeo a rubros del motor se hace por palabras clave en
 * el nombre del concepto, no por código.
 */
export async function parsearReciboLiquidacion(buffer: Buffer): Promise<ReciboLiquidacionParseado> {
  let texto: string;
  try {
    const resultado = await pdfParse(buffer);
    texto = resultado.text as string;
  } catch {
    throw new BadRequestException('No se pudo leer el archivo: ¿es un .pdf válido?');
  }

  const lineas = texto.split('\n').map((l) => l.trim());

  const empresaNombre = lineas.find((l) => l.startsWith('Empresa'))?.replace(/^Empresa/, '').trim() || null;
  const empresaCuit = lineas.find((l) => l.startsWith('C.U.I.T. Empleador'))?.replace(/^C\.U\.I\.T\. Empleador/, '').trim() || null;

  // "QMAñoApellido y NombreNro. LegajoSueldo BrutoAntiguedad" (encabezado) seguido de
  // la fila de datos "{Q?}{M}{Año}{APELLIDO, NOMBRE}{Legajo}$ {monto}".
  const idxEncabezadoLegajo = lineas.findIndex((l) => /^Q\s*M\s*Año/.test(l.replace(/\s+/g, '')));
  if (idxEncabezadoLegajo === -1 || !lineas[idxEncabezadoLegajo + 1]) {
    throw new BadRequestException('El recibo no tiene la estructura esperada (no se encontró la fila de legajo).');
  }
  // Nota: asume la columna "Q" (quincena) vacía, como en los recibos
  // mensuales — un recibo quincenal con "Q" cargado no se interpreta bien acá.
  const filaLegajo = lineas[idxEncabezadoLegajo + 1];
  const matchLegajo = filaLegajo.match(/^(\d{1,2})(\d{4})([A-ZÀ-Ýa-zà-ÿ,.\s]+?)(\d+)\$\s*([\d.,]+)/);
  if (!matchLegajo) {
    throw new BadRequestException('No se pudo leer la fila de legajo (mes/año/nombre) del recibo.');
  }
  const [, mesStr, anioStr, nombre] = matchLegajo;

  // "27-23277075-4ANALISTA02/10/2006Interbanking15/07/2026"
  const filaCuil = lineas.find((l) => /^\d{2}-\d{8}-\d/.test(l));
  if (!filaCuil) {
    throw new BadRequestException('No se encontró el C.U.I.L. del empleado en el recibo.');
  }
  const matchCuil = filaCuil.match(/^(\d{2}-\d{8}-\d)([A-ZÀ-Ýa-zà-ÿ0-9.\s]*?)(\d{2})\/(\d{2})\/(\d{4})/);
  if (!matchCuil) {
    throw new BadRequestException('No se pudo interpretar la fila de C.U.I.L./categoría/fecha de ingreso del recibo.');
  }
  const [, cuilConGuiones, categoriaRaw, diaIngreso, mesIngreso, anioIngreso] = matchCuil;

  // Tabla de conceptos del empleado: arranca después de la línea "Sueldo Bruto$ ..."
  // (la primera tabla "Concepto Unidad Base Monto" es de contribuciones del
  // empleador, no de lo liquidado al empleado) y termina en "Remunerativo:".
  const idxSueldoBruto = lineas.findIndex((l) => /^Sueldo Bruto\$/.test(l));
  const idxRemunerativo = lineas.findIndex((l) => l.startsWith('Remunerativo:'));
  if (idxSueldoBruto === -1 || idxRemunerativo === -1 || idxRemunerativo <= idxSueldoBruto) {
    throw new BadRequestException('No se encontró la tabla de conceptos liquidados al empleado en el recibo.');
  }

  const conceptos: ConceptoRecibo[] = [];
  for (const linea of lineas.slice(idxSueldoBruto + 1, idxRemunerativo)) {
    const match = linea.match(REGEX_CONCEPTO);
    if (!match) continue;
    const [, codigo, conceptoYUnidad, montoStr] = match;
    const trimmed = conceptoYUnidad.trim();
    const matchUnidad = trimmed.match(REGEX_UNIDAD_AL_FINAL);
    const concepto = (matchUnidad ? matchUnidad[1] : trimmed).trim();
    const unidad = matchUnidad ? aNumeroAr(matchUnidad[2]) : null;
    conceptos.push({ codigo, concepto, unidad, monto: aNumeroAr(montoStr) });
  }
  if (conceptos.length === 0) {
    throw new BadRequestException('No se pudo interpretar ningún concepto liquidado en el recibo.');
  }

  const lineaRemunerativo = lineas[idxRemunerativo];
  const matchRemunerativo = lineaRemunerativo.match(/Remunerativo:\$\s*([\d.,]+)/);
  const remunerativo = matchRemunerativo ? aNumeroAr(matchRemunerativo[1]) : 0;

  const esPeriodoAtipico = conceptos.some((c) => CONCEPTOS_ANOMALOS.test(c.concepto));

  return {
    empresaNombre,
    empresaCuit,
    cuil: normalizarCuil(cuilConGuiones),
    nombre: nombre.trim().replace(/,+$/, ''),
    categoria: categoriaRaw.trim() || null,
    fechaIngreso: aFecha(diaIngreso, mesIngreso, anioIngreso),
    periodo: new Date(Date.UTC(Number(anioStr), Number(mesStr) - 1, 1)),
    conceptos,
    remunerativo,
    esPeriodoAtipico,
  };
}

/** Palabras clave -> código de rubro del motor de cálculo, ver docs/motor-calculo.md
 * §2.3. Los códigos de concepto del recibo son específicos del proveedor de
 * nómina, así que el mapeo se hace por el nombre (normalizado, sin acentos). */
export function rubroParaConcepto(nombreConcepto: string): string | null {
  const texto = nombreConcepto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  // "no goz" cubre tanto "no gozadas" como la abreviatura "no goz" que usan
  // algunos proveedores de nómina (p.ej. "SAC sobre Vac No Goz Ant").
  const esVacacionesNoGozadas = texto.includes('vac') && texto.includes('no goz');
  const esAnterior = /anterior|\bant\b/.test(texto);
  const esSac = texto.includes('sac');

  if (esVacacionesNoGozadas) {
    if (esSac) return esAnterior ? 'SAC_S_VAC_ANTERIORES' : 'SAC_S_VAC';
    return esAnterior ? 'VAC_NO_GOZADAS_ANTERIORES' : 'VAC_NO_GOZADAS';
  }
  if (esSac && texto.includes('proporcional')) return 'SAC_PROP';
  // El motor calcula PREAVISO e INTEGRACION_MES con su SAC incluido (arts.
  // 232/233 LCT), así que el renglón "SAC sobre ..." suma al mismo rubro.
  if (texto.includes('preaviso')) return 'PREAVISO';
  if (/\binteg/.test(texto)) return 'INTEGRACION_MES';
  // Exige "indemn": "Antigüedad" solo es el adicional mensual por antigüedad.
  // La indemnización por fallecimiento (art. 248) no la calcula el motor, así
  // que queda sin mapear en vez de compararse contra el art. 245.
  if (texto.includes('indemn') && texto.includes('antig')) return 'IND_ANTIGUEDAD';
  return null;
}
