import { describe, expect, it } from 'vitest';
import { calcularBaseSAC, SinRemuneracionesSemestreError } from '../src/sac-base';
import { utc } from './fixtures';
import { RemuneracionMensual } from '../src/tipos';

function remuneracion(overrides: Partial<RemuneracionMensual>): RemuneracionMensual {
  return { periodo: utc(2024, 1, 1), conceptosRemunerativos: 100_000, esNormalYHabitual: true, ...overrides };
}

describe('calcularBaseSAC', () => {
  it('toma la mejor remuneración dentro del semestre del egreso, ignorando el otro semestre', () => {
    const remuneraciones = [
      remuneracion({ periodo: utc(2023, 11, 1), conceptosRemunerativos: 999_999 }), // semestre anterior, no cuenta
      remuneracion({ periodo: utc(2024, 1, 1), conceptosRemunerativos: 100_000 }),
      remuneracion({ periodo: utc(2024, 3, 1), conceptosRemunerativos: 150_000 }), // la mejor del semestre
      remuneracion({ periodo: utc(2024, 5, 1), conceptosRemunerativos: 120_000 }),
    ];

    const resultado = calcularBaseSAC(remuneraciones, utc(2024, 6, 30));

    expect(resultado.valor).toBe(150_000);
    expect(resultado.periodoSeleccionado).toEqual(utc(2024, 3, 1));
    expect(resultado.mesesConsiderados).toBe(3);
  });

  it('ignora meses no normales y habituales', () => {
    const remuneraciones = [
      remuneracion({ periodo: utc(2024, 1, 1), conceptosRemunerativos: 100_000 }),
      remuneracion({ periodo: utc(2024, 3, 1), conceptosRemunerativos: 500_000, esNormalYHabitual: false }),
    ];

    const resultado = calcularBaseSAC(remuneraciones, utc(2024, 6, 30));

    expect(resultado.valor).toBe(100_000);
  });

  it('no cuenta meses del semestre posteriores a la fecha de egreso', () => {
    const remuneraciones = [
      remuneracion({ periodo: utc(2024, 1, 1), conceptosRemunerativos: 100_000 }),
      remuneracion({ periodo: utc(2024, 5, 1), conceptosRemunerativos: 999_999 }), // después del egreso
    ];

    const resultado = calcularBaseSAC(remuneraciones, utc(2024, 3, 15));

    expect(resultado.valor).toBe(100_000);
  });

  it('lanza SinRemuneracionesSemestreError si no hay remuneraciones en el semestre', () => {
    const remuneraciones = [remuneracion({ periodo: utc(2023, 11, 1) })]; // otro semestre

    expect(() => calcularBaseSAC(remuneraciones, utc(2024, 6, 30))).toThrow(SinRemuneracionesSemestreError);
  });
});
