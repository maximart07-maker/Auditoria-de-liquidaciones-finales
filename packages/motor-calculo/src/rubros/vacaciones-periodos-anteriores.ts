import { ParametrosNormativos, RubroCalculado, VariablesCaso } from '../tipos';

/**
 * Vacaciones no gozadas de períodos (años) anteriores al de la extinción — art. 156
 * LCT. Es un control distinto del proporcional del año en curso (`VAC_NO_GOZADAS`):
 * cubre días que la empresa nunca otorgó ni compensó en ejercicios previos. Se
 * valúan al mismo valor día que el proporcional del año en curso (sueldo mensual
 * actual / divisor de vacaciones); el motor no aplica prescripción sobre los días
 * cargados, confía en que el auditor ya los depuró antes de ingresarlos.
 */
export function calcularVacacionesPeriodosAnteriores(
  v: VariablesCaso,
  p: ParametrosNormativos,
): RubroCalculado {
  const valorDia = v.sueldoMensualActual / p.divisorVacaciones;
  const monto = v.diasVacacionesPendientesPeriodosAnteriores * valorDia;

  return {
    rubro: 'VAC_NO_GOZADAS_ANTERIORES',
    monto,
    detalle: { diasPendientes: v.diasVacacionesPendientesPeriodosAnteriores, valorDia },
  };
}
