import { RubroCalculado, VariablesCaso } from '../tipos';
import { diasEntreComercial, maxFecha, semestreDe } from '../utilidades-fecha';

/** Días del año bajo la convención comercial 30/360 (12 meses × 30 días) — el
 * SAC anual completo equivale a `mejorRemuneracionSemestral` (una "mejor
 * remuneración") por año trabajado, y cada día trabajado dentro del semestre
 * vigente al egreso aporta `1/360` de esa remuneración. Con el semestre
 * completo trabajado (180 días) el resultado da exactamente 180/360 = 50% de
 * esa remuneración — nunca el 100%, porque el año completo (360 días, las dos
 * cuotas semestrales) es el que suma un sueldo entero. */
const DIAS_DEL_ANIO = 360;

/** SAC (aguinaldo) proporcional — arts. 121 a 123 LCT, según el método de cálculo
 * de la Ley 23.041: `mejorRemuneracionSemestral` (la mejor remuneración del
 * semestre que contiene el egreso, ver `calcularBaseSAC` en `../sac-base.ts`)
 * prorrateada por los días trabajados en ese semestre sobre los `DIAS_DEL_ANIO`
 * (360) — no sobre los días del semestre (180): son los mismos 180 días de un
 * semestre completo, pero expresados como fracción del año, que es la unidad
 * sobre la que se devenga el sueldo anual complementario. Se computa bajo la
 * convención comercial de mes de 30 días / año de 360 (`diasEntreComercial`),
 * sin importar meses de 28-31 días ni años bisiestos. */
export function calcularSACProporcional(v: VariablesCaso): RubroCalculado {
  const { inicio, fin } = semestreDe(v.fechaEgreso);
  const desde = maxFecha(inicio, v.fechaIngreso);

  const diasTrabajados = diasEntreComercial(desde, v.fechaEgreso) + 1;
  const diasTotalesSemestre = diasEntreComercial(inicio, fin) + 1; // siempre 180, informativo

  const monto = v.mejorRemuneracionSemestral * (diasTrabajados / DIAS_DEL_ANIO);

  return {
    rubro: 'SAC_PROP',
    monto,
    detalle: {
      semestreInicio: inicio,
      semestreFin: fin,
      diasTrabajados,
      diasTotalesSemestre,
      diasDelAnio: DIAS_DEL_ANIO,
      convencion: '30/360',
    },
  };
}
