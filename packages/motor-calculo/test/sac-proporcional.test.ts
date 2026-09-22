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

  it('prorratea cuando el ingreso ocurre dentro del semestre, con meses de 30 días', () => {
    const v = variablesBase({
      fechaIngreso: utc(2024, 4, 1), // entra a mitad del semestre 1/1-30/6 => 90/180 días bajo la convención 30/360
      fechaEgreso: utc(2024, 6, 30),
      mejorRemuneracionMensualNormalYHabitual: 120_000,
    });

    const resultado = calcularSACProporcional(v);

    expect(resultado.detalle.diasTrabajados).toBe(90);
    expect(resultado.detalle.diasTotales).toBe(180);
    expect(resultado.monto).toBeCloseTo(30_000, 2);
  });

  it('usa meses de 30 días / año de 360, no los días calendario reales', () => {
    // Semestre 1/1-30/6/2023 (no bisiesto): en días calendario reales son 181 días
    // totales y 150 trabajados (ratio ~0.8287 => $49.723,76); bajo la convención
    // comercial 30/360 el semestre siempre equivale a 180 días y quedan 150
    // trabajados (ratio exacto 5/6 => $50.000).
    const v = variablesBase({
      fechaIngreso: utc(2023, 2, 1),
      fechaEgreso: utc(2023, 6, 30),
      mejorRemuneracionMensualNormalYHabitual: 120_000,
    });

    const resultado = calcularSACProporcional(v);

    expect(resultado.detalle.diasTrabajados).toBe(150);
    expect(resultado.detalle.diasTotales).toBe(180);
    expect(resultado.monto).toBeCloseTo(50_000, 2);
  });
});
