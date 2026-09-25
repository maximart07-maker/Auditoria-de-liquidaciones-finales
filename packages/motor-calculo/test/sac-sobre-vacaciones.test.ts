import { describe, expect, it } from 'vitest';
import { calcularSACSobreVacaciones } from '../src/rubros/sac-sobre-vacaciones';
import { RubroCalculado } from '../src/tipos';

describe('calcularSACSobreVacaciones', () => {
  it('calcula 1/12 del monto de vacaciones no gozadas del año en curso', () => {
    const vacaciones: RubroCalculado = { rubro: 'VAC_NO_GOZADAS', monto: 24_000, detalle: {} };

    const resultado = calcularSACSobreVacaciones(vacaciones, 'SAC_S_VAC');

    expect(resultado.rubro).toBe('SAC_S_VAC');
    expect(resultado.monto).toBeCloseTo(2_000, 2);
  });

  it('aplica el mismo criterio (1/12) sobre la deuda de vacaciones de períodos anteriores', () => {
    const vacacionesAnteriores: RubroCalculado = { rubro: 'VAC_NO_GOZADAS_ANTERIORES', monto: 48_000, detalle: {} };

    const resultado = calcularSACSobreVacaciones(vacacionesAnteriores, 'SAC_S_VAC_ANTERIORES');

    expect(resultado.rubro).toBe('SAC_S_VAC_ANTERIORES');
    expect(resultado.monto).toBeCloseTo(4_000, 2);
  });
});
