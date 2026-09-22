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
  | 'SAC_S_VAC';

/** Datos base del caso necesarios para calcular los rubros. Todo campo variable
 * (montos, fechas, banderas de intimación) proviene de `Variable_Caso` en el modelo de datos. */
export interface VariablesCaso {
  fechaIngreso: Date;
  fechaEgreso: Date;
  tipoExtincion: TipoExtincion;
  /** "MRMNH": mejor remuneración mensual, normal y habitual — base del art. 245 LCT. */
  mejorRemuneracionMensualNormalYHabitual: number;
  /** Sueldo mensual vigente al egreso, usado para valuar el día de vacaciones. */
  sueldoMensualActual: number;
  diasVacacionesGozadosEnElAnio: number;
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
