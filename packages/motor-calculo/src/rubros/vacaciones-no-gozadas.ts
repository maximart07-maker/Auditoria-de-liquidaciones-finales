import { DiasVacacionesPorAntiguedad, ParametrosNormativos, RubroCalculado, VariablesCaso } from '../tipos';
import { aniosConFraccion, inicioDelAnio, maxFecha, mesesTrabajadosEnPeriodo } from '../utilidades-fecha';

/** Días de vacaciones anuales según antigüedad — art. 150 LCT. */
function diasPorAntiguedad(anios: number, tabla: DiasVacacionesPorAntiguedad): number {
  if (anios < 5) return tabla.hasta5Anios;
  if (anios < 10) return tabla.de5a10Anios;
  if (anios < 20) return tabla.de10a20Anios;
  return tabla.masDe20Anios;
}

/** Vacaciones no gozadas, proporcionales al año de la extinción — arts. 150 y 156 LCT. */
export function calcularVacacionesNoGozadas(
  v: VariablesCaso,
  p: ParametrosNormativos,
): RubroCalculado {
  const anios = aniosConFraccion(v.fechaIngreso, v.fechaEgreso);
  const diasAnuales = diasPorAntiguedad(anios, p.diasVacacionesPorAntiguedad);

  const desde = maxFecha(inicioDelAnio(v.fechaEgreso), v.fechaIngreso);
  const mesesTrabajados = mesesTrabajadosEnPeriodo(desde, v.fechaEgreso);

  const diasProporcionales = Math.round((diasAnuales / 12) * mesesTrabajados);
  const diasNoGozados = Math.max(diasProporcionales - v.diasVacacionesGozadosEnElAnio, 0);

  const valorDia = v.sueldoMensualActual / p.divisorVacaciones;
  const monto = diasNoGozados * valorDia;

  return {
    rubro: 'VAC_NO_GOZADAS',
    monto,
    detalle: { anios, diasAnuales, mesesTrabajados, diasProporcionales, diasNoGozados, valorDia },
  };
}
