import { RubroCalculado, VariablesCaso } from '../tipos';
import { diasEntreComercial, maxFecha, semestreDe } from '../utilidades-fecha';

/** SAC (aguinaldo) proporcional — arts. 121 a 123 LCT, según el método de cálculo
 * de la Ley 23.041: 50% de `mejorRemuneracionSemestral` (la mejor remuneración
 * del semestre que contiene el egreso, ver `calcularBaseSAC` en `../sac-base.ts`)
 * prorrateado por los días trabajados en ese semestre. Se computa bajo la
 * convención comercial de mes de 30 días / año de 360 (`diasEntreComercial`):
 * cada semestre equivale siempre a 180 días, sin importar meses de 28-31 días
 * ni años bisiestos. */
export function calcularSACProporcional(v: VariablesCaso): RubroCalculado {
  const { inicio, fin } = semestreDe(v.fechaEgreso);
  const desde = maxFecha(inicio, v.fechaIngreso);

  const diasTrabajados = diasEntreComercial(desde, v.fechaEgreso) + 1;
  const diasTotales = diasEntreComercial(inicio, fin) + 1; // siempre 180 bajo esta convención

  const monto = (v.mejorRemuneracionSemestral / 2) * (diasTrabajados / diasTotales);

  return {
    rubro: 'SAC_PROP',
    monto,
    detalle: { semestreInicio: inicio, semestreFin: fin, diasTrabajados, diasTotales, convencion: '30/360' },
  };
}
