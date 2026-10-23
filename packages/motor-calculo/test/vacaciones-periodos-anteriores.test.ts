import { describe, expect, it } from 'vitest';
import { calcularVacacionesPeriodosAnteriores } from '../src/rubros/vacaciones-periodos-anteriores';
import { crearRepositorioEnMemoria } from '../src/parametros';
import { variablesBase, utc } from './fixtures';

const parametros = crearRepositorioEnMemoria().obtenerVigentes('GENERICO', utc(2023, 5, 15));

describe('calcularVacacionesPeriodosAnteriores', () => {
  it('da 0 cuando no hay días pendientes de períodos anteriores', () => {
    const v = variablesBase({ diasVacacionesPendientesPeriodosAnteriores: 0 });

    const resultado = calcularVacacionesPeriodosAnteriores(v, parametros);

    expect(resultado.monto).toBe(0);
  });

  it('valúa los días pendientes de años anteriores al mismo valor día que el proporcional del año en curso', () => {
    const v = variablesBase({
      sueldoMensualActual: 50_000, // valorDia = 50.000 / 25 = 2.000
      diasVacacionesPendientesPeriodosAnteriores: 10,
    });

    const resultado = calcularVacacionesPeriodosAnteriores(v, parametros);

    expect(resultado.detalle.valorDia).toBeCloseTo(2_000, 2);
    expect(resultado.monto).toBeCloseTo(20_000, 2);
  });

  it('no depende de la fecha de ingreso/egreso ni aplica prescripción: toma los días cargados tal cual', () => {
    const v = variablesBase({
      fechaIngreso: utc(2010, 1, 1),
      fechaEgreso: utc(2023, 5, 15),
      sueldoMensualActual: 90_000,
      diasVacacionesPendientesPeriodosAnteriores: 45, // p.ej. deuda acumulada de varios años, ya depurada por el auditor
    });

    const resultado = calcularVacacionesPeriodosAnteriores(v, parametros);

    expect(resultado.detalle.diasPendientes).toBe(45);
    expect(resultado.monto).toBeCloseTo(45 * (90_000 / 25), 2);
  });
});
