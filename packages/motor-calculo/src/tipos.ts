export type TipoExtincion =
  | 'despido_sin_causa'
  | 'despido_con_causa'
  | 'renuncia'
  | 'mutuo_acuerdo'
  | 'vencimiento_contrato'
  | 'fallecimiento';

export type CodigoRubro =
  | 'IND_ANTIGUEDAD'
  | 'PREAVISO'
  | 'INTEGRACION_MES'
  | 'SAC_PROP'
  | 'VAC_NO_GOZADAS'
  | 'VAC_NO_GOZADAS_ANTERIORES'
  | 'SAC_S_VAC'
  | 'SAC_S_VAC_ANTERIORES';

/** Datos base del caso necesarios para calcular los rubros. Todo campo variable
 * (montos, fechas, banderas de intimación) proviene de `Variable_Caso` en el modelo de datos. */
export interface VariablesCaso {
  fechaIngreso: Date;
  fechaEgreso: Date;
  tipoExtincion: TipoExtincion;
  /** "MRMNH": mejor remuneración mensual, normal y habitual — base del art. 245 LCT. */
  mejorRemuneracionMensualNormalYHabitual: number;
  /** Mejor remuneración mensual, normal y habitual, devengada dentro del
   * semestre calendario que contiene la fecha de egreso — base del SAC
   * proporcional (arts. 121 a 123 LCT, según Ley 23.041). No es la misma
   * ventana que `mejorRemuneracionMensualNormalYHabitual` (esa mira los
   * últimos 12 meses, para el art. 245): acá solo importa el semestre en
   * curso al momento del egreso. */
  mejorRemuneracionSemestral: number;
  /** Sueldo mensual vigente al egreso, usado para valuar el día de vacaciones. */
  sueldoMensualActual: number;
  diasVacacionesGozadosEnElAnio: number;
  /** Días de vacaciones anuales que el cliente sostiene que corresponden a este
   * empleado (p.ej. un beneficio propio por encima de LCT/convenio), a cargar
   * a mano caso por caso. Nunca reduce lo que corresponde por ley o convenio:
   * `calcularVacacionesNoGozadas` solo lo toma si es mayor a `DIAS_VACACIONES_LCT`
   * y a la tabla de `ParametrosNormativos.diasVacacionesPorAntiguedad` vigente
   * (LCT/convenio, lo que sea más alto) — 0 = sin valor cargado, no hay piso a
   * comparar. */
  diasVacacionesCorrespondientesManual: number;
  /** Días de vacaciones adeudados de períodos (años) anteriores al de la extinción,
   * que la empresa nunca otorgó ni compensó — control aparte del proporcional del
   * año en curso (`diasVacacionesGozadosEnElAnio`/`VAC_NO_GOZADAS`). Se carga tal
   * cual lo informa el auditor (manual u obtenido del recibo de sueldo); el motor
   * no aplica prescripción, confía en que ya viene depurado. */
  diasVacacionesPendientesPeriodosAnteriores: number;
  preavisoOtorgado: boolean;
  convenioColectivo: string;
}

export interface DiasVacacionesPorAntiguedad {
  hasta5Anios: number;
  de5a10Anios: number;
  de10a20Anios: number;
  masDe20Anios: number;
}

/** Valores que dependen de la legislación/convenio vigente a la fecha de extinción,
 * nunca hardcodeados dentro de las fórmulas. */
export interface ParametrosNormativos {
  convenioColectivo: string;
  vigenciaDesde: Date;
  vigenciaHasta: Date | null;
  /** Tope del art. 245 LCT (3x el promedio de remuneraciones del convenio aplicable). */
  topeIndemnizatorio: number;
  divisorSAC: number;
  divisorVacaciones: number;
  diasVacacionesPorAntiguedad: DiasVacacionesPorAntiguedad;
}

export interface RubroCalculado {
  rubro: CodigoRubro;
  monto: number;
  /** Inputs y pasos intermedios de la fórmula, para trazabilidad en el informe de auditoría. */
  detalle: Record<string, unknown>;
}

/** Un mes de remuneración cargado por el auditor (manual u OCR de recibos de
 * sueldo), base para derivar la MRMNH — ver `calcularMRMNH`. */
export interface RemuneracionMensual {
  /** Primer día del mes al que corresponde la remuneración. */
  periodo: Date;
  /** Suma de conceptos remunerativos del mes (básico, horas extra, comisiones,
   * premios habituales, etc.) — excluye lo no remunerativo. */
  conceptosRemunerativos: number;
  /** false si el mes está distorsionado por algo excepcional (retroactivo,
   * liquidación de vacaciones, etc.) y no debe competir por ser la "mejor". */
  esNormalYHabitual: boolean;
}

export interface MRMNHCalculada {
  valor: number;
  periodoSeleccionado: Date;
  mesesConsiderados: number;
  detalle: Record<string, unknown>;
}

export interface LiquidacionCalculada {
  origen: 'sistema';
  fechaCalculo: Date;
  rubros: RubroCalculado[];
  total: number;
}

/** Un rubro declarado por la empresa, tal como se cargó en `Liquidacion_Rubro` (origen = empresa). */
export interface RubroDeclarado {
  rubro: CodigoRubro;
  monto: number;
}

export type Severidad = 'alta' | 'media' | 'baja';

export interface Hallazgo {
  rubro: CodigoRubro;
  montoDeclarado: number;
  montoCalculado: number;
  diferencia: number;
  porcentajeDiferencia: number;
  severidad: Severidad;
  estado: 'pendiente';
}
