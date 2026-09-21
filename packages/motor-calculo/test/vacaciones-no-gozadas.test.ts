import { describe, expect, it } from 'vitest';
import { calcularVacacionesNoGozadas } from '../src/rubros/vacaciones-no-gozadas';
import { crearRepositorioEnMemoria } from '../src/parametros';
import { variablesBase, utc } from './fixtures';

const parametros = crearRepositorioEnMemoria().obtenerVigentes('GENERICO', utc(2024, 6, 30));

describe('calcularVacacionesNoGozadas', () => {
  it('prorratea los días de vacaciones por los meses trabajados en el año', () => {
    const v = variablesBase({
      fechaIngreso: utc(2023, 1, 1),
      fechaEgreso: utc(2024, 6, 30),
      sueldoMensualActual: 25_000,
      diasVacacionesGozadosEnElAnio: 0,
    });

    const resultado = calcularVacacionesNoGozadas(v, parametros);

    expect(resultado.detalle.mesesTrabajados).toBe(6);
    expect(resultado.detalle.diasProporcionales).toBe(7);
    expect(resultado.monto).toBeCloseTo(7 * (25_000 / 25), 2);
  });

  it('descuenta los días ya gozados en el año', () => {
    const v = variablesBase({
      fechaIngreso: utc(2023, 1, 1),
      fechaEgreso: utc(2024, 6, 30),
      sueldoMensualActual: 25_000,
      diasVacacionesGozadosEnElAnio: 7,
    });

    const resultado = calcularVacacionesNoGozadas(v, parametros);

    expect(resultado.detalle.diasNoGozados).toBe(0);
    expect(resultado.monto).toBe(0);
  });
});
