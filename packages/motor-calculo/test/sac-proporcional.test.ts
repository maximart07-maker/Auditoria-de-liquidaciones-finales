import { describe, expect, it } from 'vitest';
import { calcularSACProporcional } from '../src/rubros/sac-proporcional';
import { variablesBase, utc } from './fixtures';

describe('calcularSACProporcional', () => {
  it('da la mitad de la mejor remuneración cuando se trabajó el semestre completo', () => {
    const v = variablesBase({
      fechaIngreso: utc(2020, 1, 1),
      fechaEgreso: utc(2024, 6, 30),
      mejorRemuneracionMensualNormalYHabitual: 120_000,
    });

    const resultado = calcularSACProporcional(v);

    expect(resultado.monto).toBeCloseTo(60_000, 2);
  });

  it('prorratea cuando el ingreso ocurre dentro del semestre', () => {
    const v = variablesBase({
      fechaIngreso: utc(2024, 4, 1), // entra a mitad del semestre 1/1-30/6 (182 días)
      fechaEgreso: utc(2024, 6, 30),
      mejorRemuneracionMensualNormalYHabitual: 120_000,
    });

    const resultado = calcularSACProporcional(v);

    // ~91 días trabajados sobre 182 días del semestre => monto cercano a la cuarta parte de la MRMNH
    expect(resultado.monto).toBeGreaterThan(25_000);
    expect(resultado.monto).toBeLessThan(35_000);
  });
});
