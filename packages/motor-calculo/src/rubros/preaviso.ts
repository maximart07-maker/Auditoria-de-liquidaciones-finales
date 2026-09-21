import { RubroCalculado, VariablesCaso } from '../tipos';
import { aniosConFraccion } from '../utilidades-fecha';

/** Preaviso / indemnización sustitutiva — arts. 231/232 LCT, integrada con SAC. */
export function calcularPreaviso(v: VariablesCaso): RubroCalculado {
  if (v.preavisoOtorgado) {
    return { rubro: 'PREAVISO', monto: 0, detalle: { motivo: 'preaviso otorgado en especie' } };
  }

  const anios = aniosConFraccion(v.fechaIngreso, v.fechaEgreso);
  const meses = anios < 5 ? 1 : 2;
  const mrmnh = v.mejorRemuneracionMensualNormalYHabitual;

  const montoBase = meses * mrmnh;
  const sacSobrePreaviso = montoBase / 12;
  const monto = montoBase + sacSobrePreaviso;

  return {
    rubro: 'PREAVISO',
    monto,
    detalle: { anios, meses, montoBase, sacSobrePreaviso },
  };
}
