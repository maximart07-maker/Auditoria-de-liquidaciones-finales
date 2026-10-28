/**
 * Nómina mensual › Control de Leyes › Cruce con Declaración en Línea — ver
 * docs/motor-calculo.md §11.
 *
 * 1. `parsearNominaDDJJ` lee la nómina que se descarga de Declaración en Línea
 *    (CSV separado por ";": unas líneas de cabecera con CUIT, período y
 *    secuencia, y después un renglón por CUIL con bases e importes de ARCA).
 * 2. `cruzarConDDJJ` compara, por CUIL, el reporte del sistema de liquidación y
 *    lo calculado por la app contra lo declarado: presencia, modalidad de
 *    contratación, bases imponibles, detracción e importes de aportes y
 *    contribuciones.
 */

import { BaseF931, FilaReporteF931, MODALIDAD_PASANTIA, parsearMontoArgentino, ResultadoControlF931 } from './control-f931';
import { descripcionModalidadContratacion, normalizarCodigoModalidad } from './modalidades-contratacion';

export interface FilaNominaDDJJ {
  cuil: string;
  nombre: string;
  modalidadContratacion: string;
  situacion: string;
  condicion: string;
  actividad: string;
  obraSocial: string;
  /**
   * Columna "Con Cobertura S.C.V.O.?" (Si / No). null si el archivo no la trae; puede faltar
   * (undefined) en nóminas importadas antes de que se leyera esta columna.
   */
  coberturaSCVO?: boolean | null;
  diasTrabajados: number;
  remuneracionTotal: number;
  remuneracion1: number;
  remuneracion2: number;
  remuneracion4: number;
  remuneracion5: number;
  remuneracion8: number;
  remuneracion9: number;
  remuneracion10: number;
  importeDetraer: number;
  conceptosNoRemunerativos: number;
  /** Importes de ARCA por concepto, con los mismos códigos que el panel (CONTRIB_SIPA, APORTE_OS, ...). */
  importes: Record<string, number>;
}

export interface NominaDDJJ {
  /** Solo dígitos; null si el archivo no lo trae. */
  cuit: string | null;
  /** Primer día del mes del período, en UTC. */
  periodo: Date;
  secuencia: string | null;
  contribuyente: string | null;
  filas: FilaNominaDDJJ[];
  errores: string[];
}

export class NominaDDJJInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'NominaDDJJInvalidaError';
  }
}

/** Igual que en el reporte: descarta letras acentuadas, así tolera la codificación rota. */
function clave(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type CampoNumerico = Exclude<
  keyof FilaNominaDDJJ,
  | 'cuil'
  | 'nombre'
  | 'modalidadContratacion'
  | 'situacion'
  | 'condicion'
  | 'actividad'
  | 'obraSocial'
  | 'coberturaSCVO'
  | 'importes'
>;

const COLUMNAS_TEXTO: [string, 'nombre' | 'modalidadContratacion' | 'situacion' | 'condicion' | 'actividad' | 'obraSocial'][] = [
  ['Apellido y Nombre', 'nombre'],
  ['Modalidad de Contrato', 'modalidadContratacion'],
  ['Situación', 'situacion'],
  ['Condición', 'condicion'],
  ['Actividad', 'actividad'],
  ['Obra Social', 'obraSocial'],
];

const COLUMNAS_NUMERICAS: [string, CampoNumerico][] = [
  ['Cantidad de días trabajados', 'diasTrabajados'],
  ['Remuneración Total', 'remuneracionTotal'],
  ['Remuneración 1', 'remuneracion1'],
  ['Remuneración 2', 'remuneracion2'],
  ['Remuneración 4', 'remuneracion4'],
  ['Remuneración 5', 'remuneracion5'],
  ['Remuneración 8', 'remuneracion8'],
  ['Remuneración 9', 'remuneracion9'],
  ['Remuneración 10', 'remuneracion10'],
  ['Importe a detraer', 'importeDetraer'],
  ['Conceptos no remun.', 'conceptosNoRemunerativos'],
];

/** Columna de Declaración en Línea → código de concepto del panel. */
export const COLUMNAS_IMPORTES_DDJJ: [string, string][] = [
  ['Contribución Previsional', 'CONTRIB_SIPA'],
  ['Contribución PAMI', 'CONTRIB_INSSJP'],
  ['Fondo Nac. de Empleo', 'CONTRIB_FNE'],
  ['Contribución Asig. Familiares', 'CONTRIB_AAFF'],
  ['Contribución OS', 'CONTRIB_OBRA_SOCIAL'],
  ['Contribución ANSSAL', 'CONTRIB_FSR'],
  ['Aporte Previsional', 'APORTE_SIPA'],
  ['Aporte PAMI', 'APORTE_INSSJP'],
  ['Aporte OS', 'APORTE_OBRA_SOCIAL'],
  ['Aporte ANSSAL', 'APORTE_FSR'],
];

const MESES_NUMERO = /^(\d{1,2})[\s/-]+(\d{4})$/;

export function parsearNominaDDJJ(texto: string): NominaDDJJ {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const indiceEncabezado = lineas.findIndex((l) => clave(l.split(';')[0] ?? '') === 'cuil');
  if (indiceEncabezado < 0) {
    throw new NominaDDJJInvalidaError(
      'No se encontró la fila de títulos (la que empieza con "CUIL"). ¿Es la nómina de Declaración en Línea separada por punto y coma?',
    );
  }

  // Cabecera: "CUIT:;30-...", "Período;09 2026", "Secuencia:;0 - Original", "Contribuyente:;..."
  const cabecera = new Map<string, string>();
  for (const l of lineas.slice(0, indiceEncabezado)) {
    const [k, v] = l.split(';');
    if (k && v !== undefined) cabecera.set(clave(k), v.trim());
  }
  const textoPeriodo = cabecera.get('periodo') ?? cabecera.get('perodo') ?? '';
  const mp = MESES_NUMERO.exec(textoPeriodo);
  if (!mp || Number(mp[1]) < 1 || Number(mp[1]) > 12) {
    throw new NominaDDJJInvalidaError(`No se reconoce el período del archivo ("${textoPeriodo}"). Se espera "MM AAAA".`);
  }
  const periodo = new Date(Date.UTC(Number(mp[2]), Number(mp[1]) - 1, 1));
  const cuit = (cabecera.get('cuit') ?? '').replace(/\D/g, '') || null;

  const encabezados = lineas[indiceEncabezado].split(';').map(clave);
  // Primera aparición de cada título (hay títulos repetidos, como "* porcentaje aplicado").
  const posicion = (titulo: string) => encabezados.indexOf(clave(titulo));
  const requeridas = [...COLUMNAS_TEXTO.map(([t]) => t), ...COLUMNAS_NUMERICAS.map(([t]) => t), ...COLUMNAS_IMPORTES_DDJJ.map(([t]) => t)];
  const faltantes = requeridas.filter((t) => posicion(t) < 0);
  if (faltantes.length > 0) {
    throw new NominaDDJJInvalidaError(`A la nómina le faltan columnas: ${faltantes.join(', ')}.`);
  }

  const filas: FilaNominaDDJJ[] = [];
  const errores: string[] = [];
  for (let i = indiceEncabezado + 1; i < lineas.length; i++) {
    if (lineas[i].replace(/;/g, '').trim() === '') continue;
    const celdas = lineas[i].split(';');
    const celda = (titulo: string) => (celdas[posicion(titulo)] ?? '').trim();
    const cuil = (celdas[0] ?? '').replace(/\D/g, '');
    if (cuil.length !== 11) {
      errores.push(`Renglón ${i + 1}: CUIL "${celdas[0]}" inválido.`);
      continue;
    }
    const fila = { cuil, importes: {} } as FilaNominaDDJJ;
    for (const [t, campo] of COLUMNAS_TEXTO) fila[campo] = celda(t);
    fila.modalidadContratacion = normalizarCodigoModalidad(fila.modalidadContratacion);
    // Columna opcional: si no está, no se controla la cobertura de SCVO.
    const textoSCVO = posicion('Con Cobertura S.C.V.O.?') >= 0 ? clave(celda('Con Cobertura S.C.V.O.?')) : '';
    fila.coberturaSCVO = textoSCVO === 'si' ? true : textoSCVO === 'no' ? false : null;

    let valida = true;
    const leerMonto = (t: string): number => {
      const valor = parsearMontoArgentino(celda(t) || '0');
      if (valor === null) {
        errores.push(`Renglón ${i + 1}: el valor "${celda(t)}" de "${t}" no es un monto válido.`);
        valida = false;
        return 0;
      }
      return valor;
    };
    for (const [t, campo] of COLUMNAS_NUMERICAS) fila[campo] = leerMonto(t);
    for (const [t, codigo] of COLUMNAS_IMPORTES_DDJJ) fila.importes[codigo] = leerMonto(t);
    if (valida) filas.push(fila);
  }

  return {
    cuit,
    periodo,
    secuencia: cabecera.get('secuencia') || null,
    contribuyente: cabecera.get('contribuyente') || null,
    filas,
    errores,
  };
}

// ---------------------------------------------------------------------------
// Cruce por CUIL
// ---------------------------------------------------------------------------

/** `declaracion`: un dato declarado que no corresponde a la modalidad (p.ej. SCVO a un pasante). */
export type GrupoDiferenciaDDJJ = 'presencia' | 'modalidad' | 'base' | 'importe' | 'declaracion';

export interface DiferenciaDDJJ {
  grupo: GrupoDiferenciaDDJJ;
  concepto: string;
  /** Lo que dice el reporte del sistema de liquidación (bases, modalidad) o lo que calculó la app (importes). */
  valorSistema: number | string | null;
  valorDDJJ: number | string | null;
  /** DDJJ − sistema, solo para montos. */
  diferencia: number | null;
  /** Aclaración para leer la diferencia (p.ej. qué significa cada código). */
  detalle?: string;
}

export interface EmpleadoCruceDDJJ {
  cuil: string;
  nombre: string;
  legajo: string | null;
  diferencias: DiferenciaDDJJ[];
}

export interface ResultadoCruceDDJJ {
  resumen: {
    empleadosReporte: number;
    empleadosDDJJ: number;
    sinDiferencias: number;
    conDiferencias: number;
    soloEnReporte: number;
    soloEnDDJJ: number;
    /**
     * Diferencias de Remuneración Total de menos de $1 que están solo en los conceptos no
     * remunerativos (centavos de redondeo de la DDJJ): no se listan como diferencia.
     */
    remuneracionTotalPorRedondeo: number;
    /** Pasantes (027 en la DDJJ) declarados con cobertura de SCVO. */
    pasantesConSCVO: number;
    /** La nómina guardada no trae la cobertura de SCVO (se importó antes de este control): hay que reimportarla. */
    coberturaSCVOSinDato: boolean;
  };
  /** Diferencia total por concepto de importe (DDJJ − app), para los CUIL presentes en ambos. */
  totalesImportes: { codigo: string; concepto: string; app: number; ddjj: number; diferencia: number }[];
  empleados: EmpleadoCruceDDJJ[];
}

const redondear = (v: number) => Math.round(v * 100) / 100;
/** Tolerancia de un centavo por redondeo. */
const TOLERANCIA = 0.011;

const BASES_CRUCE: [BaseF931, string][] = [
  ['remuneracion1', 'Remuneración 1'],
  ['remuneracion2', 'Remuneración 2'],
  ['remuneracion4', 'Remuneración 4'],
  ['remuneracion5', 'Remuneración 5'],
  ['remuneracion8', 'Remuneración 8'],
  ['remuneracion9', 'Remuneración 9'],
  ['remuneracion10', 'Remuneración 10'],
];

const describir = (codigo: string) => descripcionModalidadContratacion(codigo) ?? 'fuera del catálogo';

export function cruzarConDDJJ(
  reporte: FilaReporteF931[],
  control: ResultadoControlF931,
  ddjj: FilaNominaDDJJ[],
): ResultadoCruceDDJJ {
  const porCuilReporte = new Map(reporte.map((f) => [f.cuil, f]));
  const porCuilControl = new Map(control.empleados.map((e) => [e.cuil, e]));
  const porCuilDDJJ = new Map(ddjj.map((f) => [f.cuil, f]));
  const descripcionConcepto = new Map(
    [...control.contribuciones, ...control.aportes].map((c) => [c.codigo, c.descripcion]),
  );
  const codigosImporte = COLUMNAS_IMPORTES_DDJJ.map(([, codigo]) => codigo);

  const empleados: EmpleadoCruceDDJJ[] = [];
  let remuneracionTotalPorRedondeo = 0;
  let pasantesConSCVO = 0;
  const totales = new Map(codigosImporte.map((c) => [c, { app: 0, ddjj: 0 }]));

  const cuils = [...new Set([...porCuilReporte.keys(), ...porCuilDDJJ.keys()])];
  for (const cuil of cuils) {
    const r = porCuilReporte.get(cuil);
    const e = porCuilControl.get(cuil);
    const d = porCuilDDJJ.get(cuil);
    const diferencias: DiferenciaDDJJ[] = [];
    const monto = (grupo: GrupoDiferenciaDDJJ, concepto: string, sistema: number, declarado: number) => {
      if (Math.abs(declarado - sistema) > TOLERANCIA) {
        diferencias.push({ grupo, concepto, valorSistema: sistema, valorDDJJ: declarado, diferencia: redondear(declarado - sistema) });
      }
    };

    if (!r || !e) {
      diferencias.push({
        grupo: 'presencia',
        concepto: 'Solo está en la DDJJ',
        valorSistema: null,
        valorDDJJ: 'Declarado',
        diferencia: null,
        detalle: `Situación de revista ${d!.situacion} · Remuneración total $ ${d!.remuneracionTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      });
    } else if (!d) {
      diferencias.push({ grupo: 'presencia', concepto: 'No está en la DDJJ', valorSistema: 'En el reporte', valorDDJJ: null, diferencia: null });
    } else {
      if (normalizarCodigoModalidad(r.modalidadContratacion) !== d.modalidadContratacion) {
        diferencias.push({
          grupo: 'modalidad',
          concepto: 'Modalidad de contratación',
          valorSistema: normalizarCodigoModalidad(r.modalidadContratacion),
          valorDDJJ: d.modalidadContratacion,
          diferencia: null,
          detalle: `Sistema: ${describir(r.modalidadContratacion)} · DDJJ: ${describir(d.modalidadContratacion)}`,
        });
      }
      const difTotal = redondear(d.remuneracionTotal - r.remuneracionTotal);
      if (Math.abs(difTotal) > TOLERANCIA) {
        // La parte remunerativa de la DDJJ (total − no remunerativos) coincide con la base sin tope del reporte.
        const remunerativoCoincide = Math.abs(d.remuneracionTotal - d.conceptosNoRemunerativos - r.remuneracion2) <= TOLERANCIA;
        if (remunerativoCoincide && Math.abs(difTotal) < 1) remuneracionTotalPorRedondeo++;
        else monto('base', 'Remuneración Total', r.remuneracionTotal, d.remuneracionTotal);
      }
      for (const [base, nombre] of BASES_CRUCE) monto('base', nombre, r[base], d[base]);
      monto('base', 'Importe a detraer', r.totalDetraer, d.importeDetraer);
      for (const codigo of codigosImporte) {
        const app = e.contribuciones[codigo] ?? e.aportes[codigo] ?? 0;
        const declarado = d.importes[codigo] ?? 0;
        const t = totales.get(codigo)!;
        t.app += app;
        t.ddjj += declarado;
        monto('importe', descripcionConcepto.get(codigo) ?? codigo, app, declarado);
      }
    }

    // La pasantía (Ley 26.427) no es relación de dependencia: no lleva SCVO.
    if (d && d.modalidadContratacion === MODALIDAD_PASANTIA && d.coberturaSCVO === true) {
      pasantesConSCVO++;
      diferencias.push({
        grupo: 'declaracion',
        concepto: 'Cobertura SCVO declarada a un pasante',
        valorSistema: 'No corresponde',
        valorDDJJ: 'Si',
        diferencia: null,
        detalle: 'La pasantía (Ley 26.427) no es relación de dependencia y no lleva Seguro Colectivo de Vida Obligatorio.',
      });
    }

    if (diferencias.length > 0) {
      empleados.push({ cuil, nombre: r?.nombre ?? d!.nombre, legajo: r?.legajo ?? null, diferencias });
    }
  }

  empleados.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const enAmbos = cuils.filter((c) => porCuilReporte.has(c) && porCuilDDJJ.has(c)).length;
  const soloEnReporte = cuils.filter((c) => !porCuilDDJJ.has(c)).length;
  const soloEnDDJJ = cuils.filter((c) => !porCuilReporte.has(c)).length;
  const conDiferenciasEnAmbos = empleados.filter((x) => x.diferencias[0].grupo !== 'presencia').length;

  return {
    resumen: {
      empleadosReporte: reporte.length,
      empleadosDDJJ: ddjj.length,
      sinDiferencias: enAmbos - conDiferenciasEnAmbos,
      conDiferencias: conDiferenciasEnAmbos,
      soloEnReporte,
      soloEnDDJJ,
      remuneracionTotalPorRedondeo,
      pasantesConSCVO,
      coberturaSCVOSinDato: ddjj.some((f) => f.coberturaSCVO === undefined),
    },
    totalesImportes: codigosImporte.map((codigo) => {
      const t = totales.get(codigo)!;
      return {
        codigo,
        concepto: descripcionConcepto.get(codigo) ?? codigo,
        app: redondear(t.app),
        ddjj: redondear(t.ddjj),
        diferencia: redondear(t.ddjj - t.app),
      };
    }),
    empleados,
  };
}
