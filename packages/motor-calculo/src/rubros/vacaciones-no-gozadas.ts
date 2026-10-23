import { DiasVacacionesPorAntiguedad, ParametrosNormativos, RubroCalculado, VariablesCaso } from '../tipos';
import { aniosCompletos, diasEntreComercial, finDelAnio, inicioDelAnio, maxFecha } from '../utilidades-fecha';
import { DIAS_VACACIONES_LCT } from '../parametros';

/** Días del año bajo la convención comercial 30/360 — mismo criterio que el SAC
 * proporcional (`./sac-proporcional.ts`): la proporción de días trabajados en
 * el año se mide contra 360, no contra los días calendario reales del año
 * (365/366). */
const DIAS_DEL_ANIO = 360;

/** Días de vacaciones anuales según antigüedad — art. 150 LCT. */
function diasPorAntiguedad(anios: number, tabla: DiasVacacionesPorAntiguedad): number {
  if (anios < 5) return tabla.hasta5Anios;
  if (anios < 10) return tabla.de5a10Anios;
  if (anios < 20) return tabla.de10a20Anios;
  return tabla.masDe20Anios;
}

/**
 * Días de vacaciones anuales que corresponden a este empleado: el mayor entre
 * (a) el piso legal (`DIAS_VACACIONES_LCT`, art. 150 LCT), (b) la tabla del
 * convenio colectivo/cliente vigente (`p.diasVacacionesPorAntiguedad` — puede
 * mejorar el piso legal, nunca empeorarlo, así que también se compara acá en
 * vez de asumir que ya lo respeta) y (c) el valor manual que haya cargado el
 * cliente para este caso puntual (`v.diasVacacionesCorrespondientesManual`,
 * p.ej. un beneficio propio por encima de LCT/convenio) — este último nunca
 * puede *bajar* lo que corresponde por ley o convenio, solo subirlo.
 */
function diasAnualesCorrespondientes(anios: number, v: VariablesCaso, p: ParametrosNormativos): number {
  const diasSegunLey = diasPorAntiguedad(anios, DIAS_VACACIONES_LCT);
  const diasSegunConvenio = diasPorAntiguedad(anios, p.diasVacacionesPorAntiguedad);
  const diasSegunLeyOConvenio = Math.max(diasSegunLey, diasSegunConvenio);
  return Math.max(diasSegunLeyOConvenio, v.diasVacacionesCorrespondientesManual);
}

/** Vacaciones no gozadas, proporcionales al año de la extinción — arts. 150 y 156 LCT. */
export function calcularVacacionesNoGozadas(
  v: VariablesCaso,
  p: ParametrosNormativos,
): RubroCalculado {
  // Art. 150 LCT: "para determinar la extensión de las vacaciones atendiendo a la
  // antigüedad en el empleo, se computará como tal aquélla que tendría el
  // trabajador al 31 de diciembre del año que correspondan las mismas" — no la
  // antigüedad real a `fechaEgreso`. Un trabajador que se va a mitad de año igual
  // usa la antigüedad que habría cumplido para fin de ese año calendario.
  const anios = aniosCompletos(v.fechaIngreso, finDelAnio(v.fechaEgreso));
  const diasAnuales = diasAnualesCorrespondientes(anios, v, p);

  const desde = maxFecha(inicioDelAnio(v.fechaEgreso), v.fechaIngreso);
  const diasTrabajadosEnAnio = diasEntreComercial(desde, v.fechaEgreso) + 1;

  const diasProporcionales = Math.round(diasAnuales * (diasTrabajadosEnAnio / DIAS_DEL_ANIO));
  const diasNoGozados = Math.max(diasProporcionales - v.diasVacacionesGozadosEnElAnio, 0);

  const valorDia = v.sueldoMensualActual / p.divisorVacaciones;
  const monto = diasNoGozados * valorDia;

  return {
    rubro: 'VAC_NO_GOZADAS',
    monto,
    detalle: {
      anios,
      diasAnuales,
      diasManualCargados: v.diasVacacionesCorrespondientesManual || null,
      diasTrabajadosEnAnio,
      diasDelAnio: DIAS_DEL_ANIO,
      diasProporcionales,
      diasNoGozados,
      valorDia,
    },
  };
}
