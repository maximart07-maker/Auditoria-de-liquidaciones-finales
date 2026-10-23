import { CodigoRubro, RubroCalculado } from '../tipos';

/**
 * SAC sobre vacaciones no gozadas: las vacaciones no gozadas integran la base de
 * cálculo del aguinaldo. Se aplica con el mismo criterio tanto al proporcional del
 * año en curso como a la deuda de períodos anteriores — cada una liquida su propio
 * rubro (`rubroDestino`) para mantener la trazabilidad separada en la auditoría.
 */
export function calcularSACSobreVacaciones(vacaciones: RubroCalculado, rubroDestino: CodigoRubro): RubroCalculado {
  const monto = vacaciones.monto / 12;

  return {
    rubro: rubroDestino,
    monto,
    detalle: { montoVacacionesNoGozadas: vacaciones.monto },
  };
}
