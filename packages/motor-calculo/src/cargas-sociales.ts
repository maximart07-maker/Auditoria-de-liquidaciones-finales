/**
 * Costo laboral y contribuciones patronales (SUSS / ARCA) a partir de la
 * configuración de cargas sociales de un cliente — ver docs/motor-calculo.md §10.
 *
 * El cálculo es por empleado: `sueldoBruto` es la remuneración bruta de un
 * empleado y los totales de la nómina se obtienen multiplicando por
 * `cantidadEmpleados`. Así la detracción (Ley 27.541), la cuota fija de la ART
 * y el SCVO se aplican una vez por trabajador, como en el F.931.
 */

export type TipoEmpleadorSUSS = 'pyme' | 'gran_empresa';

export type RegimenDiferencialSUSS =
  | 'comun'
  | 'choferes'
  | 'construccion'
  | 'docentes'
  | 'insalubres'
  | 'manual';

export type RegimenDetraccion = 'general' | 'incrementado' | 'sin_detraccion';

export interface ConfiguracionCargasSociales {
  tipoEmpleador: TipoEmpleadorSUSS;
  regimenDiferencial: RegimenDiferencialSUSS;
  /** % adicional SUSS del régimen diferencial (0 para actividad común, 2 fijo para docentes). */
  adicionalDiferencialPorcentaje: number;
  aplicaFAL: boolean;
  /** % variable de la ART sobre el sueldo bruto. */
  artPorcentaje: number;
  /** Cuota fija mensual de la ART (FFEP), por empleado. */
  artCuotaFija: number;
  /** Costo mensual del Seguro Colectivo de Vida Obligatorio, por empleado. */
  scvoPorEmpleado: number;
  regimenDetraccion: RegimenDetraccion;
  /**
   * Monto base de detracción a usar en lugar del valor de la ley (p.ej. un
   * valor actualizado por normativa posterior). Null = valor de la ley.
   */
  montoDetraccionPersonalizado: number | null;
  /** Horas semanales de la jornada parcial (art. 92 ter LCT). Null = jornada completa. */
  horasSemanalesJornadaParcial: number | null;
}

export interface DatosNominaCargasSociales {
  /** Sueldo bruto remunerativo de un empleado. */
  sueldoBruto: number;
  cantidadEmpleados: number;
  incluyeSAC: boolean;
}

export const ALICUOTA_SUSS_BASE: Record<TipoEmpleadorSUSS, number> = { pyme: 18, gran_empresa: 20.4 };
export const ALICUOTA_OBRA_SOCIAL = 6;
export const ALICUOTA_FAL: Record<TipoEmpleadorSUSS, number> = { pyme: 2.5, gran_empresa: 1 };
export const HORAS_JORNADA_COMPLETA = 48;

/** Montos base de detracción para jornada completa (arts. 22 y 23 Ley 27.541). */
export const MONTO_DETRACCION_LEY: Record<RegimenDetraccion, number> = {
  general: 7003.68,
  incrementado: 17509.2,
  sin_detraccion: 0,
};

/** Rango admitido del % adicional por régimen diferencial ([min, max]). */
export const RANGO_ADICIONAL_DIFERENCIAL: Record<RegimenDiferencialSUSS, [number, number]> = {
  comun: [0, 0],
  choferes: [2, 5],
  construccion: [2, 5],
  docentes: [2, 2],
  insalubres: [2, 5],
  manual: [0, 100],
};

export class ConfiguracionCargasSocialesInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ConfiguracionCargasSocialesInvalidaError';
  }
}

function esNoNegativo(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0;
}

export function validarConfiguracionCargasSociales(config: ConfiguracionCargasSociales): void {
  if (!(config.tipoEmpleador in ALICUOTA_SUSS_BASE)) {
    throw new ConfiguracionCargasSocialesInvalidaError(`Tipo de empleador desconocido: ${config.tipoEmpleador}`);
  }
  const rango = RANGO_ADICIONAL_DIFERENCIAL[config.regimenDiferencial];
  if (!rango) {
    throw new ConfiguracionCargasSocialesInvalidaError(`Régimen diferencial desconocido: ${config.regimenDiferencial}`);
  }
  const adicional = config.adicionalDiferencialPorcentaje;
  if (!Number.isFinite(adicional) || adicional < rango[0] || adicional > rango[1]) {
    throw new ConfiguracionCargasSocialesInvalidaError(
      rango[0] === rango[1]
        ? `El régimen "${config.regimenDiferencial}" lleva un adicional fijo de ${rango[0]}% (se recibió ${adicional}%).`
        : `El adicional del régimen "${config.regimenDiferencial}" debe estar entre ${rango[0]}% y ${rango[1]}% (se recibió ${adicional}%).`,
    );
  }
  if (!(config.regimenDetraccion in MONTO_DETRACCION_LEY)) {
    throw new ConfiguracionCargasSocialesInvalidaError(`Régimen de detracción desconocido: ${config.regimenDetraccion}`);
  }
  if (!esNoNegativo(config.artPorcentaje) || config.artPorcentaje > 100) {
    throw new ConfiguracionCargasSocialesInvalidaError('El % variable de la ART debe estar entre 0 y 100.');
  }
  if (!esNoNegativo(config.artCuotaFija)) {
    throw new ConfiguracionCargasSocialesInvalidaError('La cuota fija de la ART no puede ser negativa.');
  }
  if (!esNoNegativo(config.scvoPorEmpleado)) {
    throw new ConfiguracionCargasSocialesInvalidaError('El costo del SCVO no puede ser negativo.');
  }
  if (config.montoDetraccionPersonalizado !== null) {
    if (config.regimenDetraccion === 'sin_detraccion') {
      throw new ConfiguracionCargasSocialesInvalidaError('No se puede personalizar el monto si se eligió "Sin detracción".');
    }
    if (!esNoNegativo(config.montoDetraccionPersonalizado)) {
      throw new ConfiguracionCargasSocialesInvalidaError('El monto de detracción no puede ser negativo.');
    }
  }
  const horas = config.horasSemanalesJornadaParcial;
  if (horas !== null && (!Number.isFinite(horas) || horas <= 0 || horas >= HORAS_JORNADA_COMPLETA)) {
    throw new ConfiguracionCargasSocialesInvalidaError(
      `Las horas de la jornada parcial deben ser mayores a 0 y menores a ${HORAS_JORNADA_COMPLETA}.`,
    );
  }
}

export interface LineaCargasSociales {
  concepto: 'SUSS' | 'OBRA_SOCIAL' | 'FAL' | 'ART' | 'SCVO';
  descripcion: string;
  /** Base imponible por empleado (null para conceptos de monto fijo). */
  baseImponible: number | null;
  /** Alícuota aplicada, en %. */
  alicuota: number | null;
  /** Monto fijo por empleado incluido en el importe. */
  fijo: number | null;
  importePorEmpleado: number;
  importeTotal: number;
}

export interface ResultadoCargasSociales {
  resumen: {
    alicuotaSUSSBase: number;
    adicionalDiferencial: number;
    alicuotaSUSSTotal: number;
    factorJornada: number;
    horasSemanales: number;
    montoDetraccionBase: number;
    montoDetraccionAplicado: number;
    alicuotaFAL: number;
  };
  lineas: LineaCargasSociales[];
  totales: {
    sueldoBrutoPorEmpleado: number;
    sueldoBrutoTotal: number;
    cargasPorEmpleado: number;
    cargasTotal: number;
    costoLaboralPorEmpleado: number;
    costoLaboralTotal: number;
    /** Cargas patronales / sueldo bruto, en %. */
    sobrecostoPorcentaje: number;
  };
}

const redondear = (valor: number) => Math.round(valor * 100) / 100;

export function calcularCargasSociales(
  config: ConfiguracionCargasSociales,
  datos: DatosNominaCargasSociales,
): ResultadoCargasSociales {
  validarConfiguracionCargasSociales(config);
  if (!esNoNegativo(datos.sueldoBruto)) {
    throw new ConfiguracionCargasSocialesInvalidaError('El sueldo bruto no puede ser negativo.');
  }
  if (!Number.isInteger(datos.cantidadEmpleados) || datos.cantidadEmpleados < 1) {
    throw new ConfiguracionCargasSocialesInvalidaError('La cantidad de empleados debe ser un entero mayor o igual a 1.');
  }

  const bruto = datos.sueldoBruto;
  const n = datos.cantidadEmpleados;

  // 1. Alícuota SUSS total = base + adicional diferencial.
  const alicuotaSUSSBase = ALICUOTA_SUSS_BASE[config.tipoEmpleador];
  const alicuotaSUSSTotal = redondear(alicuotaSUSSBase + config.adicionalDiferencialPorcentaje);

  // 2. Prorrateo de la detracción por jornada parcial (art. 92 ter LCT).
  const horasSemanales = config.horasSemanalesJornadaParcial ?? HORAS_JORNADA_COMPLETA;
  const factorJornada = horasSemanales / HORAS_JORNADA_COMPLETA;
  const montoDetraccionBase =
    config.regimenDetraccion === 'sin_detraccion'
      ? 0
      : config.montoDetraccionPersonalizado ?? MONTO_DETRACCION_LEY[config.regimenDetraccion];

  // 3. Con SAC, la detracción proporcional se incrementa un 50%.
  const montoDetraccionAplicado = redondear(montoDetraccionBase * factorJornada * (datos.incluyeSAC ? 1.5 : 1));

  // 4-5. Base imponible y contribución SUSS.
  const baseSUSS = Math.max(0, bruto - montoDetraccionAplicado);
  const suss = redondear((baseSUSS * alicuotaSUSSTotal) / 100);

  // 6. Contribuciones sobre el 100% del bruto y costos fijos.
  const obraSocial = redondear((bruto * ALICUOTA_OBRA_SOCIAL) / 100);
  const alicuotaFAL = config.aplicaFAL ? ALICUOTA_FAL[config.tipoEmpleador] : 0;
  const fal = redondear((bruto * alicuotaFAL) / 100);
  const art = redondear((bruto * config.artPorcentaje) / 100 + config.artCuotaFija);
  const scvo = redondear(config.scvoPorEmpleado);

  const linea = (
    concepto: LineaCargasSociales['concepto'],
    descripcion: string,
    baseImponible: number | null,
    alicuota: number | null,
    fijo: number | null,
    importe: number,
  ): LineaCargasSociales => ({
    concepto,
    descripcion,
    baseImponible: baseImponible === null ? null : redondear(baseImponible),
    alicuota,
    fijo,
    importePorEmpleado: importe,
    importeTotal: redondear(importe * n),
  });

  const lineas: LineaCargasSociales[] = [
    linea('SUSS', 'Contribuciones SUSS (base + adicional diferencial)', baseSUSS, alicuotaSUSSTotal, null, suss),
    linea('OBRA_SOCIAL', 'Contribución Obra Social', bruto, ALICUOTA_OBRA_SOCIAL, null, obraSocial),
    linea('FAL', 'Fondo de Asistencia Laboral (FAL)', bruto, alicuotaFAL, null, fal),
    linea('ART', 'ART (variable + cuota fija FFEP)', bruto, config.artPorcentaje, config.artCuotaFija, art),
    linea('SCVO', 'Seguro Colectivo de Vida Obligatorio', null, null, config.scvoPorEmpleado, scvo),
  ];

  // 7. Totales.
  const cargasPorEmpleado = redondear(suss + obraSocial + fal + art + scvo);
  const cargasTotal = redondear(lineas.reduce((acc, l) => acc + l.importeTotal, 0));
  const sueldoBrutoTotal = redondear(bruto * n);

  return {
    resumen: {
      alicuotaSUSSBase,
      adicionalDiferencial: config.adicionalDiferencialPorcentaje,
      alicuotaSUSSTotal,
      factorJornada,
      horasSemanales,
      montoDetraccionBase,
      montoDetraccionAplicado,
      alicuotaFAL,
    },
    lineas,
    totales: {
      sueldoBrutoPorEmpleado: redondear(bruto),
      sueldoBrutoTotal,
      cargasPorEmpleado,
      cargasTotal,
      costoLaboralPorEmpleado: redondear(bruto + cargasPorEmpleado),
      costoLaboralTotal: redondear(sueldoBrutoTotal + cargasTotal),
      sobrecostoPorcentaje: bruto > 0 ? redondear((cargasPorEmpleado / bruto) * 100) : 0,
    },
  };
}
