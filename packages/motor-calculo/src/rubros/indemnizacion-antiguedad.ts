import { ParametrosNormativos, RubroCalculado, VariablesCaso } from '../tipos';
import { aniosConFraccion } from '../utilidades-fecha';

/** Proporción mínima del MRMNH real que debe conservar la base de cálculo aun aplicando
 * el tope convencional (doctrina posterior a CSJN "Vizzoti", que limita la quita al 33%). */
const PISO_SOBRE_MRMNH = 0.67;

/** Indemnización por antigüedad — art. 245 LCT. */
export function calcularIndemnizacionAntiguedad(
  v: VariablesCaso,
  p: ParametrosNormativos,
): RubroCalculado {
  const anios = aniosConFraccion(v.fechaIngreso, v.fechaEgreso);
  const mrmnh = v.mejorRemuneracionMensualNormalYHabitual;

  let base = Math.min(mrmnh, p.topeIndemnizatorio);
  const piso = mrmnh * PISO_SOBRE_MRMNH;
  if (base < piso) base = piso;

  const monto = base * Math.max(anios, 1);

  return {
    rubro: 'IND_ANTIGUEDAD',
    monto,
    detalle: { anios, mrmnh, base, piso, tope: p.topeIndemnizatorio },
  };
}
