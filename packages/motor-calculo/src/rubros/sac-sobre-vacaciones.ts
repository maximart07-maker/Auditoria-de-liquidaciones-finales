import { RubroCalculado } from '../tipos';

/** SAC sobre vacaciones no gozadas: las vacaciones no gozadas integran la base de
 * cálculo del aguinaldo. Depende del resultado de `calcularVacacionesNoGozadas`. */
export function calcularSACSobreVacaciones(vacacionesNoGozadas: RubroCalculado): RubroCalculado {
  const monto = vacacionesNoGozadas.monto / 12;

  return {
    rubro: 'SAC_S_VAC',
    monto,
    detalle: { montoVacacionesNoGozadas: vacacionesNoGozadas.monto },
  };
}
