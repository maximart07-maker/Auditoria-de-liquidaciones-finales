import { RubroCalculado, VariablesCaso } from '../tipos';
import { diasEntre, maxFecha, semestreDe } from '../utilidades-fecha';

/** SAC (aguinaldo) proporcional — Ley 23.041. */
export function calcularSACProporcional(v: VariablesCaso): RubroCalculado {
  const { inicio, fin } = semestreDe(v.fechaEgreso);
  const desde = maxFecha(inicio, v.fechaIngreso);

  const diasTrabajados = diasEntre(desde, v.fechaEgreso) + 1;
  const diasTotales = diasEntre(inicio, fin) + 1;

  const monto = (v.mejorRemuneracionMensualNormalYHabitual / 2) * (diasTrabajados / diasTotales);

  return {
    rubro: 'SAC_PROP',
    monto,
    detalle: { semestreInicio: inicio, semestreFin: fin, diasTrabajados, diasTotales },
  };
}
