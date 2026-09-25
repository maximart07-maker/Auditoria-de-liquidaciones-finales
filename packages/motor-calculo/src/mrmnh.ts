import { MRMNHCalculada, RemuneracionMensual } from './tipos';
import { maxFecha, sumarMeses } from './utilidades-fecha';

export class SinRemuneracionesError extends Error {
  constructor() {
    super(
      'No hay remuneraciones normales y habituales cargadas dentro del último año trabajado ' +
        '(o del período de prestación de servicios, si es menor a un año — art. 245 LCT) para calcular la MRMNH',
    );
    this.name = 'SinRemuneracionesError';
  }
}

/**
 * Mejor remuneración mensual, normal y habitual — art. 245 LCT: el mayor mes
 * remunerativo y habitual devengado durante el último año de trabajo, o durante
 * el tiempo de prestación de servicios si éste fuera menor. Reemplaza la carga
 * manual de un único número: el auditor carga el histórico mensual de
 * remuneraciones (`RemuneracionMensual`, con su `fuente` manual/ocr/importado) y
 * esta función pura deriva la MRMNH de forma trazable y reproducible.
 */
export function calcularMRMNH(
  remuneraciones: RemuneracionMensual[],
  fechaIngreso: Date,
  fechaEgreso: Date,
): MRMNHCalculada {
  const inicioVentana = maxFecha(fechaIngreso, sumarMeses(fechaEgreso, -12));

  const enVentana = remuneraciones.filter(
    (r) =>
      r.esNormalYHabitual &&
      r.periodo.getTime() >= inicioVentana.getTime() &&
      r.periodo.getTime() <= fechaEgreso.getTime(),
  );

  if (enVentana.length === 0) {
    throw new SinRemuneracionesError();
  }

  const mejor = enVentana.reduce((max, r) => (r.conceptosRemunerativos > max.conceptosRemunerativos ? r : max));

  return {
    valor: mejor.conceptosRemunerativos,
    periodoSeleccionado: mejor.periodo,
    mesesConsiderados: enVentana.length,
    detalle: { inicioVentana, fechaEgreso, mesesConsiderados: enVentana.length, periodoSeleccionado: mejor.periodo },
  };
}
