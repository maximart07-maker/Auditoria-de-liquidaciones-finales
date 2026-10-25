/**
 * Nómina mensual › Control de Leyes — ver docs/motor-calculo.md §11.
 *
 * 1. `parsearReporteF931` lee el reporte de bases del F.931 que exporta el
 *    sistema de liquidación del cliente (CSV separado por ";", un renglón por
 *    empleado, montos con formato argentino).
 * 2. `calcularControlF931` arma el panel de conceptos de seguridad social del
 *    período: las contribuciones salen de la configuración de cargas sociales
 *    del cliente aplicada sobre las bases del reporte; los aportes, con las
 *    alícuotas de ley (`ALICUOTAS_APORTES_F931`) sobre su base.
 */

import {
  TipoEmpleadorSUSS,
  ALICUOTA_FAL,
  ALICUOTA_OBRA_SOCIAL,
  ALICUOTA_SUSS_BASE,
  ConfiguracionCargasSociales,
  MONTO_DETRACCION_LEY,
  validarConfiguracionCargasSociales,
} from './cargas-sociales';

// ---------------------------------------------------------------------------
// Lectura del reporte
// ---------------------------------------------------------------------------

export interface FilaReporteF931 {
  /** Primer día del mes del período, en UTC. */
  periodo: Date;
  legajo: string;
  nombre: string;
  /** Solo dígitos (11). */
  cuil: string;
  /** Código de modalidad de contratación (tabla de ARCA), tal como viene. */
  modalidadContratacion: string;
  /** Código de condición SIJP, tal como viene. */
  condicion: string;
  /** Marca de convenio colectivo (1 = dentro de convenio), tal como viene. */
  convenio: string;
  remuneracionTotal: number;
  remuneracion1: number;
  remuneracion2: number;
  /** No se usa en ningún cálculo; se guarda si viene en el reporte (0 si no viene). */
  remuneracion3: number;
  remuneracion4: number;
  remuneracion5: number;
  remuneracion8: number;
  remuneracion9: number;
  remuneracion10: number;
  montoDetraer: number;
  montoDetraerSAC: number;
  totalDetraer: number;
}

type CampoReporte = keyof FilaReporteF931;

/** Encabezado del reporte → campo. */
const COLUMNAS_REPORTE: [string, CampoReporte][] = [
  ['Período', 'periodo'],
  ['Empleado', 'legajo'],
  ['Apellido y Nombre', 'nombre'],
  ['CUIL', 'cuil'],
  ['Contrato', 'modalidadContratacion'],
  ['Condición SIJP', 'condicion'],
  ['Convenio Colectivo', 'convenio'],
  ['Remuneración Total', 'remuneracionTotal'],
  ['Remuneración 1', 'remuneracion1'],
  ['Remuneración 2', 'remuneracion2'],
  ['Remuneración 3', 'remuneracion3'],
  ['Remuneración 4', 'remuneracion4'],
  ['Remuneración 5', 'remuneracion5'],
  ['Remuneración 8', 'remuneracion8'],
  ['Remuneración 9', 'remuneracion9'],
  ['Remuneración 10', 'remuneracion10'],
  ['Monto a detraer', 'montoDetraer'],
  ['Monto a detraer SAC', 'montoDetraerSAC'],
  ['Total Importe a detraer', 'totalDetraer'],
];

/** Clave de comparación de encabezados: descarta las letras acentuadas en vez de
 * reemplazarlas, así "Período" coincide aunque el archivo llegue con la
 * codificación rota ("Per�odo"). */
function claveEncabezado(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Columnas que pueden faltar en el reporte (se toman como 0). */
const COLUMNAS_OPCIONALES: CampoReporte[] = ['remuneracion3'];

const CAMPOS_TEXTO: CampoReporte[] = ['legajo', 'nombre', 'cuil', 'modalidadContratacion', 'condicion', 'convenio'];

export class ReporteF931InvalidoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ReporteF931InvalidoError';
  }
}

export interface ResultadoLecturaReporteF931 {
  filas: FilaReporteF931[];
  /** Renglones que no se pudieron leer (no frenan la importación del resto). */
  errores: string[];
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/�/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "15.810.040,15" → 15810040.15 · "0" → 0 · "-1.234,5" → -1234.5. */
export function parsearMontoArgentino(texto: string): number | null {
  const limpio = texto.trim().replace(/\s|\$/g, '');
  if (!/^-?[\d.]*,?\d*$/.test(limpio) || !/\d/.test(limpio)) return null;
  const valor = Number(limpio.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(valor) ? valor : null;
}

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};

/** Acepta "sept-26", "sep-2026", "09/2026", "2026-09" y "202609". */
export function parsearPeriodoF931(texto: string): Date | null {
  const t = normalizarTexto(texto).replace(/\./g, '');
  let anio: number | undefined;
  let mes: number | undefined;

  const conNombre = /^([a-z]+)[-/ ](\d{2}|\d{4})$/.exec(t);
  const numerico = /^(\d{1,2})[-/](\d{4})$/.exec(t);
  const iso = /^(\d{4})-?(\d{2})$/.exec(t);
  if (conNombre) {
    mes = MESES[conNombre[1].slice(0, 3)];
    anio = Number(conNombre[2]);
    if (anio < 100) anio += 2000;
  } else if (numerico) {
    mes = Number(numerico[1]);
    anio = Number(numerico[2]);
  } else if (iso) {
    anio = Number(iso[1]);
    mes = Number(iso[2]);
  }
  if (!anio || !mes || mes < 1 || mes > 12) return null;
  return new Date(Date.UTC(anio, mes - 1, 1));
}

export function parsearReporteF931(texto: string): ResultadoLecturaReporteF931 {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const indiceEncabezado = lineas.findIndex((l) => l.trim() !== '');
  if (indiceEncabezado < 0) throw new ReporteF931InvalidoError('El archivo está vacío.');

  const encabezados = lineas[indiceEncabezado].split(';').map(claveEncabezado);
  const posiciones = new Map<CampoReporte, number>();
  const faltantes: string[] = [];
  for (const [encabezado, campo] of COLUMNAS_REPORTE) {
    const posicion = encabezados.indexOf(claveEncabezado(encabezado));
    if (posicion < 0) {
      if (!COLUMNAS_OPCIONALES.includes(campo)) faltantes.push(encabezado);
    }
    else posiciones.set(campo, posicion);
  }
  if (faltantes.length > 0) {
    throw new ReporteF931InvalidoError(
      `Al reporte le faltan columnas: ${faltantes.join(', ')}. ¿Está separado por punto y coma (;)?`,
    );
  }

  const filas: FilaReporteF931[] = [];
  const errores: string[] = [];
  for (let i = indiceEncabezado + 1; i < lineas.length; i++) {
    if (lineas[i].trim() === '') continue;
    const numeroLinea = i + 1;
    const celdas = lineas[i].split(';');
    const celda = (campo: CampoReporte) => {
      const posicion = posiciones.get(campo);
      return posicion === undefined ? '' : (celdas[posicion] ?? '').trim();
    };

    const periodo = parsearPeriodoF931(celda('periodo'));
    if (!periodo) {
      errores.push(`Renglón ${numeroLinea}: período "${celda('periodo')}" no reconocido.`);
      continue;
    }
    const cuil = celda('cuil').replace(/\D/g, '');
    if (cuil.length !== 11) {
      errores.push(`Renglón ${numeroLinea}: CUIL "${celda('cuil')}" inválido.`);
      continue;
    }

    const fila: Partial<FilaReporteF931> = { periodo };
    let valida = true;
    for (const [, campo] of COLUMNAS_REPORTE) {
      if (campo === 'periodo') continue;
      if (CAMPOS_TEXTO.includes(campo)) {
        (fila as Record<string, unknown>)[campo] = celda(campo);
        continue;
      }
      const monto = parsearMontoArgentino(celda(campo) || '0');
      if (monto === null) {
        errores.push(`Renglón ${numeroLinea}: el valor "${celda(campo)}" no es un monto válido.`);
        valida = false;
        break;
      }
      (fila as Record<string, unknown>)[campo] = monto;
    }
    if (!valida) continue;
    fila.cuil = cuil;
    fila.nombre = fila.nombre!.replace(/\s+,/g, ',').replace(/\s+/g, ' ');
    filas.push(fila as FilaReporteF931);
  }

  return { filas, errores };
}

// ---------------------------------------------------------------------------
// Panel de conceptos de seguridad social
// ---------------------------------------------------------------------------

export type BaseF931 =
  | 'remuneracion1'
  | 'remuneracion2'
  | 'remuneracion4'
  | 'remuneracion5'
  | 'remuneracion8'
  | 'remuneracion9'
  | 'remuneracion10';

/** Qué representa cada base del reporte. */
export const DESCRIPCION_BASES_F931: Record<BaseF931, string> = {
  remuneracion1: 'Aportes SIPA',
  remuneracion2: 'Contribuciones SIPA',
  remuneracion4: 'Aportes Obra Social y FSR',
  remuneracion5: 'Aportes INSSJP',
  remuneracion8: 'Contribuciones Obra Social y FSR',
  remuneracion9: 'Ley de Riesgos del Trabajo',
  remuneracion10: 'Contribuciones SIPA con detracción',
};

const ETIQUETA_BASE: Record<BaseF931, string> = {
  remuneracion1: 'Rem. 1',
  remuneracion2: 'Rem. 2',
  remuneracion4: 'Rem. 4',
  remuneracion5: 'Rem. 5',
  remuneracion8: 'Rem. 8',
  remuneracion9: 'Rem. 9',
  remuneracion10: 'Rem. 10',
};

export interface ConceptoF931 {
  codigo: string;
  descripcion: string;
  /** Base del reporte sobre la que se calcula (null para montos fijos). */
  base: BaseF931 | null;
  baseEtiqueta: string | null;
  baseTotal: number | null;
  /** Alícuota en %. null = no aplica o sin confirmar. */
  alicuota: number | null;
  /** Monto fijo por empleado incluido en el importe. */
  fijoPorEmpleado: number | null;
  /** null = no se calcula todavía (alícuota pendiente de confirmar). */
  importe: number | null;
  pendiente: string | null;
}

export type SeveridadObservacionF931 = 'alta' | 'media' | 'baja';

export interface ObservacionF931 {
  severidad: SeveridadObservacionF931;
  titulo: string;
  detalle: string;
  /** CUILs alcanzados. */
  empleados: { cuil: string; nombre: string; legajo: string }[];
}

export interface EmpleadoControlF931 {
  legajo: string;
  nombre: string;
  cuil: string;
  modalidadContratacion: string;
  condicion: string;
  convenio: string;
  remuneracionTotal: number;
  bases: Record<BaseF931, number>;
  totalDetraer: number;
  /** Importe por concepto de contribución (código → importe). */
  contribuciones: Record<string, number>;
  totalContribuciones: number;
  /** Importe por concepto de aporte (código → importe). */
  aportes: Record<string, number>;
  totalAportes: number;
}

export interface ResultadoControlF931 {
  resumen: {
    cantidadEmpleados: number;
    remuneracionTotal: number;
    totalDetraer: number;
    totalContribuciones: number;
    totalAportes: number;
    alicuotaSUSSTotal: number;
    montoDetraccionCliente: number;
  };
  bases: { base: BaseF931; etiqueta: string; descripcion: string; total: number }[];
  contribuciones: ConceptoF931[];
  aportes: ConceptoF931[];
  observaciones: ObservacionF931[];
  empleados: EmpleadoControlF931[];
}

const BASES: BaseF931[] = [
  'remuneracion1',
  'remuneracion2',
  'remuneracion4',
  'remuneracion5',
  'remuneracion8',
  'remuneracion9',
  'remuneracion10',
];

const redondear = (valor: number) => Math.round(valor * 100) / 100;
/** Tolerancia de redondeo al comparar montos del reporte. */
const TOLERANCIA = 0.05;

/** Alícuotas de aportes personales, en %. El 3 % de obra social incluye la parte del FSR (ex ANSSAL). */
export const ALICUOTAS_APORTES_F931 = { SIPA: 11, INSSJP: 3, OBRA_SOCIAL: 3 } as const;

/**
 * Reparto de la contribución SUSS por subsistema (Decreto 814/01 y art. 19 Ley 27.541), en %.
 * El adicional del régimen diferencial se suma a SIPA.
 */
export const DESGLOSE_CONTRIBUCIONES_SUSS: Record<
  TipoEmpleadorSUSS,
  { SIPA: number; INSSJP: number; FNE: number; AAFF: number }
> = {
  gran_empresa: { SIPA: 12.35, INSSJP: 1.8, FNE: 1.11, AAFF: 5.14 },
  pyme: { SIPA: 10.77, INSSJP: 1.59, FNE: 0.94, AAFF: 4.7 },
};

/** Parte del aporte y de la contribución de obra social que va al Fondo Solidario de Redistribución. */
export const PROPORCION_FSR = 0.15;

const alicuotaRedondeada = (valor: number) => Math.round(valor * 10_000) / 10_000;
/** Divide una alícuota de obra social en la parte de la obra social y la del FSR. */
export function repartirObraSocialFSR(alicuota: number): { obraSocial: number; fsr: number } {
  const fsr = alicuotaRedondeada(alicuota * PROPORCION_FSR);
  return { obraSocial: alicuotaRedondeada(alicuota - fsr), fsr };
}
const APORTE_OS = repartirObraSocialFSR(ALICUOTAS_APORTES_F931.OBRA_SOCIAL);
const CONTRIBUCION_OS = repartirObraSocialFSR(ALICUOTA_OBRA_SOCIAL);

/** Modalidad de contratación de pasantías: sin aporte SIPA y solo contribuciones de obra social, ART y SCVO. */
export const MODALIDAD_PASANTIA = '27';

/** Modalidad de contratación que solo lleva ART: sin aportes ni otras contribuciones. */
export const MODALIDAD_SOLO_ART = '99';

/** Contribuciones que llevan los pasantes (la de obra social incluye su parte FSR). */
const CONTRIBUCIONES_PASANTIA = ['CONTRIB_OBRA_SOCIAL', 'CONTRIB_FSR', 'CONTRIB_ART', 'CONTRIB_SCVO'];

/** Si a una modalidad de contratación le corresponde un concepto (aporte o contribución). */
export function aplicaConceptoF931(codigo: string, modalidad: string): boolean {
  if (modalidad === MODALIDAD_SOLO_ART) return codigo === 'CONTRIB_ART';
  if (modalidad === MODALIDAD_PASANTIA) {
    if (codigo.startsWith('APORTE_')) return codigo !== 'APORTE_SIPA';
    return CONTRIBUCIONES_PASANTIA.includes(codigo);
  }
  return true;
}

const APORTES: { codigo: string; descripcion: string; base: BaseF931; alicuota: number }[] = [
  { codigo: 'APORTE_SIPA', descripcion: 'Aporte jubilatorio SIPA', base: 'remuneracion1', alicuota: ALICUOTAS_APORTES_F931.SIPA },
  { codigo: 'APORTE_INSSJP', descripcion: 'Aporte INSSJP (Ley 19.032)', base: 'remuneracion5', alicuota: ALICUOTAS_APORTES_F931.INSSJP },
  { codigo: 'APORTE_OBRA_SOCIAL', descripcion: 'Aporte Obra Social', base: 'remuneracion4', alicuota: APORTE_OS.obraSocial },
  {
    codigo: 'APORTE_FSR',
    descripcion: 'Aporte Fondo Solidario de Redistribución (FSR)',
    base: 'remuneracion4',
    alicuota: APORTE_OS.fsr,
  },
];

/** Contribuciones SUSS: una línea por subsistema. */
function lineasSUSS(config: ConfiguracionCargasSociales, base: BaseF931) {
  const desglose = DESGLOSE_CONTRIBUCIONES_SUSS[config.tipoEmpleador];
  const adicional = config.adicionalDiferencialPorcentaje;
  return [
    {
      codigo: 'CONTRIB_SIPA',
      descripcion: adicional > 0 ? `Contribución SIPA (incluye ${adicional}% de régimen diferencial)` : 'Contribución SIPA',
      base,
      alicuota: alicuotaRedondeada(desglose.SIPA + adicional),
      fijo: null,
    },
    { codigo: 'CONTRIB_INSSJP', descripcion: 'Contribución INSSJP (PAMI)', base, alicuota: desglose.INSSJP, fijo: null },
    { codigo: 'CONTRIB_FNE', descripcion: 'Contribución Fondo Nacional de Empleo (FNE)', base, alicuota: desglose.FNE, fijo: null },
    { codigo: 'CONTRIB_AAFF', descripcion: 'Contribución Asignaciones Familiares (AAFF)', base, alicuota: desglose.AAFF, fijo: null },
  ];
}

export function calcularControlF931(
  config: ConfiguracionCargasSociales,
  filas: FilaReporteF931[],
): ResultadoControlF931 {
  validarConfiguracionCargasSociales(config);

  const alicuotaSUSSTotal = redondear(ALICUOTA_SUSS_BASE[config.tipoEmpleador] + config.adicionalDiferencialPorcentaje);
  const alicuotaFAL = config.aplicaFAL ? ALICUOTA_FAL[config.tipoEmpleador] : 0;
  const montoDetraccionCliente =
    config.regimenDetraccion === 'sin_detraccion'
      ? 0
      : config.montoDetraccionPersonalizado ?? MONTO_DETRACCION_LEY[config.regimenDetraccion];

  // Base de SUSS y FAL: Rem. 10 (con detracción). Sin detracción no hay base
  // reducida, así que se toma la base de contribuciones completa (Rem. 2).
  const baseContribuciones: BaseF931 = montoDetraccionCliente > 0 ? 'remuneracion10' : 'remuneracion2';

  const definicionContribuciones: {
    codigo: string;
    descripcion: string;
    base: BaseF931 | null;
    alicuota: number | null;
    fijo: number | null;
  }[] = [
    ...lineasSUSS(config, baseContribuciones),
    { codigo: 'CONTRIB_OBRA_SOCIAL', descripcion: 'Contribución Obra Social', base: 'remuneracion8', alicuota: CONTRIBUCION_OS.obraSocial, fijo: null },
    {
      codigo: 'CONTRIB_FSR',
      descripcion: 'Contribución Fondo Solidario de Redistribución (FSR)',
      base: 'remuneracion8',
      alicuota: CONTRIBUCION_OS.fsr,
      fijo: null,
    },
    ...(config.aplicaFAL
      ? [{ codigo: 'CONTRIB_FAL', descripcion: 'Fondo de Asistencia Laboral (FAL)', base: baseContribuciones, alicuota: alicuotaFAL, fijo: null }]
      : []),
    {
      codigo: 'CONTRIB_ART',
      descripcion: 'ART (variable + cuota fija FFEP)',
      base: 'remuneracion9',
      alicuota: config.artPorcentaje,
      fijo: config.artCuotaFija,
    },
    { codigo: 'CONTRIB_SCVO', descripcion: 'Seguro Colectivo de Vida Obligatorio', base: null, alicuota: null, fijo: config.scvoPorEmpleado },
  ];

  const empleados: EmpleadoControlF931[] = filas.map((f) => {
    const bases = Object.fromEntries(BASES.map((b) => [b, f[b]])) as Record<BaseF931, number>;
    const contribuciones: Record<string, number> = {};
    for (const c of definicionContribuciones) {
      if (!aplicaConceptoF931(c.codigo, f.modalidadContratacion)) {
        contribuciones[c.codigo] = 0;
        continue;
      }
      const variable = c.base && c.alicuota !== null ? (bases[c.base] * c.alicuota) / 100 : 0;
      contribuciones[c.codigo] = redondear(variable + (c.fijo ?? 0));
    }
    const aportes: Record<string, number> = {};
    for (const a of APORTES) {
      aportes[a.codigo] = aplicaConceptoF931(a.codigo, f.modalidadContratacion)
        ? redondear((bases[a.base] * a.alicuota) / 100)
        : 0;
    }
    return {
      legajo: f.legajo,
      nombre: f.nombre,
      cuil: f.cuil,
      modalidadContratacion: f.modalidadContratacion,
      condicion: f.condicion,
      convenio: f.convenio,
      remuneracionTotal: f.remuneracionTotal,
      bases,
      totalDetraer: f.totalDetraer,
      contribuciones,
      totalContribuciones: redondear(Object.values(contribuciones).reduce((a, b) => a + b, 0)),
      aportes,
      totalAportes: redondear(Object.values(aportes).reduce((a, b) => a + b, 0)),
    };
  });

  const sumar = (fn: (e: EmpleadoControlF931) => number) => redondear(empleados.reduce((acc, e) => acc + fn(e), 0));
  const totalBase = (b: BaseF931) => sumar((e) => e.bases[b]);
  /** Base de un concepto: solo la de los empleados a los que se les calcula. */
  const baseDeConcepto = (codigo: string, b: BaseF931) =>
    sumar((e) => (aplicaConceptoF931(codigo, e.modalidadContratacion) ? e.bases[b] : 0));

  const contribuciones: ConceptoF931[] = definicionContribuciones.map((c) => ({
    codigo: c.codigo,
    descripcion: c.descripcion,
    base: c.base,
    baseEtiqueta: c.base ? ETIQUETA_BASE[c.base] : null,
    baseTotal: c.base ? baseDeConcepto(c.codigo, c.base) : null,
    alicuota: c.alicuota,
    fijoPorEmpleado: c.fijo,
    importe: sumar((e) => e.contribuciones[c.codigo]),
    pendiente: null,
  }));

  const aportes: ConceptoF931[] = APORTES.map((a) => ({
    codigo: a.codigo,
    descripcion: a.descripcion,
    base: a.base,
    baseEtiqueta: ETIQUETA_BASE[a.base],
    baseTotal: baseDeConcepto(a.codigo, a.base),
    alicuota: a.alicuota,
    fijoPorEmpleado: null,
    importe: sumar((e) => e.aportes[a.codigo]),
    pendiente: null,
  }));

  return {
    resumen: {
      cantidadEmpleados: empleados.length,
      remuneracionTotal: sumar((e) => e.remuneracionTotal),
      totalDetraer: sumar((e) => e.totalDetraer),
      totalContribuciones: redondear(contribuciones.reduce((acc, c) => acc + (c.importe ?? 0), 0)),
      totalAportes: redondear(aportes.reduce((acc, a) => acc + (a.importe ?? 0), 0)),
      alicuotaSUSSTotal,
      montoDetraccionCliente,
    },
    bases: BASES.map((b) => ({ base: b, etiqueta: ETIQUETA_BASE[b], descripcion: DESCRIPCION_BASES_F931[b], total: totalBase(b) })),
    contribuciones,
    aportes,
    observaciones: observacionesF931(filas, montoDetraccionCliente),
    empleados,
  };
}

/** Controles de consistencia del reporte contra sí mismo y contra la configuración del cliente. */
function observacionesF931(filas: FilaReporteF931[], montoDetraccionCliente: number): ObservacionF931[] {
  const ref = (f: FilaReporteF931) => ({ cuil: f.cuil, nombre: f.nombre, legajo: f.legajo });
  const difiere = (a: number, b: number) => Math.abs(a - b) > TOLERANCIA;
  const observaciones: ObservacionF931[] = [];

  const agregar = (
    severidad: SeveridadObservacionF931,
    titulo: string,
    detalle: string,
    alcanzadas: FilaReporteF931[],
  ) => {
    if (alcanzadas.length > 0) observaciones.push({ severidad, titulo, detalle, empleados: alcanzadas.map(ref) });
  };

  agregar(
    'baja',
    'Pasantes: régimen de pasantías',
    `Contrato ${MODALIDAD_PASANTIA}: no se les calcula aporte SIPA aunque el reporte informe Rem. 1, y de las contribuciones solo llevan obra social (con FSR), ART y SCVO.`,
    filas.filter((f) => f.modalidadContratacion === MODALIDAD_PASANTIA),
  );
  agregar(
    'baja',
    'Contrato 99: solo ART',
    `Contrato ${MODALIDAD_SOLO_ART}: solo se calcula la ART; no se le calculan aportes ni otras contribuciones aunque el reporte informe bases.`,
    filas.filter((f) => f.modalidadContratacion === MODALIDAD_SOLO_ART),
  );
  agregar(
    'alta',
    'La base con detracción no cierra',
    'Rem. 10 debería ser Rem. 2 menos el total a detraer.',
    filas.filter((f) => f.totalDetraer > 0 && difiere(f.remuneracion10, f.remuneracion2 - f.totalDetraer)),
  );
  agregar(
    'alta',
    'El total a detraer no suma',
    'El total a detraer debería ser el monto a detraer más el monto a detraer SAC.',
    filas.filter((f) => difiere(f.totalDetraer, f.montoDetraer + f.montoDetraerSAC)),
  );
  agregar(
    'alta',
    'Detracción mayor a la base',
    'El total a detraer supera la base de contribuciones (Rem. 2).',
    filas.filter((f) => f.totalDetraer - f.remuneracion2 > TOLERANCIA),
  );
  if (montoDetraccionCliente > 0) {
    agregar(
      'media',
      'Detracción distinta a la configurada para el cliente',
      `El monto a detraer no coincide con el del cliente ($ ${montoDetraccionCliente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}). Puede ser proporcional por jornada parcial o por días trabajados: revisar.`,
      filas.filter((f) => f.montoDetraer > 0 && difiere(f.montoDetraer, montoDetraccionCliente)),
    );
    agregar(
      'baja',
      'Empleados sin detracción',
      'No tienen monto a detraer y su Rem. 10 viene en cero, así que no se les calculan contribuciones SUSS. Confirmar que su modalidad de contratación no lleve esas contribuciones.',
      // Pasantes y contrato 99 ya tienen su propia observación.
      filas.filter(
        (f) =>
          f.totalDetraer === 0 &&
          f.remuneracion10 === 0 &&
          f.modalidadContratacion !== MODALIDAD_PASANTIA &&
          f.modalidadContratacion !== MODALIDAD_SOLO_ART,
      ),
    );
  }

  return observaciones;
}
