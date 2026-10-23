import { RubroCalculado, VariablesCaso } from '../tipos';
import { diaDelMes, diasEnElMes } from '../utilidades-fecha';

/** Integración del mes de despido — art. 233 LCT, integrada con SAC. */
export function calcularIntegracionMes(v: VariablesCaso): RubroCalculado {
  const totalDiasMes = diasEnElMes(v.fechaEgreso);
  const diaEgreso = diaDelMes(v.fechaEgreso);

  if (diaEgreso === totalDiasMes) {
    return { rubro: 'INTEGRACION_MES', monto: 0, detalle: { motivo: 'egreso el último día del mes' } };
  }

  const diasRestantes = totalDiasMes - diaEgreso;
  const mrmnh = v.mejorRemuneracionMensualNormalYHabitual;
  const montoBase = (mrmnh / totalDiasMes) * diasRestantes;
  const sacSobreIntegracion = montoBase / 12;
  const monto = montoBase + sacSobreIntegracion;

  return {
    rubro: 'INTEGRACION_MES',
    monto,
    detalle: { totalDiasMes, diaEgreso, diasRestantes, montoBase, sacSobreIntegracion },
  };
}
