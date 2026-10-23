import { describe, expect, it } from 'vitest';
import { calcularMRMNH, SinRemuneracionesError } from '../src/mrmnh';
import { RemuneracionMensual } from '../src/tipos';
import { utc } from './fixtures';

function remuneracion(overrides: Partial<RemuneracionMensual>): RemuneracionMensual {
  return { periodo: utc(2023, 1, 1), conceptosRemunerativos: 100_000, esNormalYHabitual: true, ...overrides };
}

describe('calcularMRMNH', () => {
  it('toma el mayor mes remunerativo y habitual dentro del último año trabajado', () => {
    const remuneraciones: RemuneracionMensual[] = [
      remuneracion({ periodo: utc(2022, 6, 1), conceptosRemunerativos: 80_000 }),
      remuneracion({ periodo: utc(2022, 12, 1), conceptosRemunerativos: 110_000 }),
      remuneracion({ periodo: utc(2023, 3, 1), conceptosRemunerativos: 95_000 }),
    ];

    const resultado = calcularMRMNH(remuneraciones, utc(2015, 1, 10), utc(2023, 5, 15));

    expect(resultado.valor).toBe(110_000);
    expect(resultado.periodoSeleccionado).toEqual(utc(2022, 12, 1));
    expect(resultado.mesesConsiderados).toBe(3);
  });

  it('excluye los meses marcados como no normales/habituales, aunque sean el monto más alto', () => {
    const remuneraciones: RemuneracionMensual[] = [
      remuneracion({ periodo: utc(2023, 1, 1), conceptosRemunerativos: 90_000 }),
      remuneracion({ periodo: utc(2023, 2, 1), conceptosRemunerativos: 500_000, esNormalYHabitual: false }), // p.ej. un retroactivo excepcional
    ];

    const resultado = calcularMRMNH(remuneraciones, utc(2015, 1, 10), utc(2023, 5, 15));

    expect(resultado.valor).toBe(90_000);
  });

  it('ignora meses fuera de la ventana de los últimos 12 meses trabajados', () => {
    const remuneraciones: RemuneracionMensual[] = [
      remuneracion({ periodo: utc(2021, 1, 1), conceptosRemunerativos: 300_000 }), // más de un año antes del egreso
      remuneracion({ periodo: utc(2023, 1, 1), conceptosRemunerativos: 100_000 }),
    ];

    const resultado = calcularMRMNH(remuneraciones, utc(2015, 1, 10), utc(2023, 5, 15));

    expect(resultado.valor).toBe(100_000);
    expect(resultado.mesesConsiderados).toBe(1);
  });

  it('usa el tiempo de prestación de servicios como ventana si es menor a un año', () => {
    const remuneraciones: RemuneracionMensual[] = [
      remuneracion({ periodo: utc(2022, 12, 1), conceptosRemunerativos: 300_000 }), // antes del ingreso
      remuneracion({ periodo: utc(2023, 2, 1), conceptosRemunerativos: 100_000 }),
    ];

    // ingresó el 1/1/2023, hace menos de un año trabajando al egreso
    const resultado = calcularMRMNH(remuneraciones, utc(2023, 1, 1), utc(2023, 5, 15));

    expect(resultado.valor).toBe(100_000);
    expect(resultado.mesesConsiderados).toBe(1);
  });

  it('lanza SinRemuneracionesError si no hay remuneraciones normales/habituales en la ventana', () => {
    expect(() => calcularMRMNH([], utc(2015, 1, 10), utc(2023, 5, 15))).toThrow(SinRemuneracionesError);

    const soloExcepcionales: RemuneracionMensual[] = [
      remuneracion({ periodo: utc(2023, 1, 1), esNormalYHabitual: false }),
    ];
    expect(() => calcularMRMNH(soloExcepcionales, utc(2015, 1, 10), utc(2023, 5, 15))).toThrow(SinRemuneracionesError);
  });
});
