import { RemuneracionMensual } from './tipos';
import { semestreDe } from './utilidades-fecha';

export class SinRemuneracionesSemestreError extends Error {
  constructor(inicio: Date, fin: Date) {
    super(
      'No hay remuneraciones normales y habituales cargadas dentro del semestre ' +
        `${inicio.toISOString().slice(0, 10)} a ${fin.toISOString().slice(0, 10)} ` +
        '(arts. 121 a 123 LCT, según Ley 23.041) para calcular la base del SAC proporcional',
    );
    this.name = 'SinRemuneracionesSemestreError';
  }
}

export interface BaseSACCalculada {
  valor: number;
  periodoSeleccionado: Date;
  mesesConsiderados: number;
  detalle: Record<string, unknown>;
}

/**
 * Mejor remuneración mensual devengada dentro del semestre calendario que
 * contiene la fecha de egreso — base del SAC proporcional según el método de
 * cálculo fijado por la Ley 23.041 (que sustituyó los arts. 121/122 LCT) y su
 * Decreto reglamentario 1078/1984: "50% de la mayor remuneración mensual
 * devengada... dentro de los semestres que culminan en junio y diciembre".
 * A diferencia de la MRMNH del art. 245 (`calcularMRMNH`), que mira los
 * últimos 12 meses trabajados, esta base solo mira el semestre vigente al
 * egreso — son dos ventanas y, en general, dos valores distintos.
 */
export function calcularBaseSAC(remuneraciones: RemuneracionMensual[], fechaEgreso: Date): BaseSACCalculada {
  const { inicio, fin } = semestreDe(fechaEgreso);

  const enVentana = remuneraciones.filter(
    (r) => r.esNormalYHabitual && r.periodo.getTime() >= inicio.getTime() && r.periodo.getTime() <= fechaEgreso.getTime(),
  );

  if (enVentana.length === 0) {
    throw new SinRemuneracionesSemestreError(inicio, fin);
  }

  const mejor = enVentana.reduce((max, r) => (r.conceptosRemunerativos > max.conceptosRemunerativos ? r : max));

  return {
    valor: mejor.conceptosRemunerativos,
    periodoSeleccionado: mejor.periodo,
    mesesConsiderados: enVentana.length,
    detalle: { semestreInicio: inicio, semestreFin: fin, mesesConsiderados: enVentana.length, periodoSeleccionado: mejor.periodo },
  };
}
