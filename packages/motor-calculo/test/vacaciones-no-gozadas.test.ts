import { describe, expect, it } from 'vitest';
import { calcularVacacionesNoGozadas } from '../src/rubros/vacaciones-no-gozadas';
import { conDiasVacacionesPorAntiguedad, crearRepositorioEnMemoria } from '../src/parametros';
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

  it('usa la tabla del convenio si otorga más días que el piso legal', () => {
    const parametrosConvenio = conDiasVacacionesPorAntiguedad(crearRepositorioEnMemoria(), {
      hasta5Anios: 20,
    }).obtenerVigentes('GENERICO', utc(2024, 6, 30));
    const v = variablesBase({
      fechaIngreso: utc(2023, 1, 1), // < 5 años de antigüedad al egreso
      fechaEgreso: utc(2024, 6, 30),
      sueldoMensualActual: 25_000,
    });

    const resultado = calcularVacacionesNoGozadas(v, parametrosConvenio);

    expect(resultado.detalle.diasAnuales).toBe(20); // no los 14 del piso legal
  });

  it('ignora una tabla de convenio por debajo del piso legal (LCT es orden público)', () => {
    const parametrosConvenio = conDiasVacacionesPorAntiguedad(crearRepositorioEnMemoria(), {
      hasta5Anios: 5, // inválido/por debajo de LCT, no debería poder aplicarse nunca
    }).obtenerVigentes('GENERICO', utc(2024, 6, 30));
    const v = variablesBase({
      fechaIngreso: utc(2023, 1, 1),
      fechaEgreso: utc(2024, 6, 30),
      sueldoMensualActual: 25_000,
    });

    const resultado = calcularVacacionesNoGozadas(v, parametrosConvenio);

    expect(resultado.detalle.diasAnuales).toBe(14); // el piso legal, no los 5 del convenio
  });

  it('toma el valor manual del cliente si supera lo que corresponde por ley/convenio', () => {
    const v = variablesBase({
      fechaIngreso: utc(2023, 1, 1),
      fechaEgreso: utc(2024, 6, 30),
      sueldoMensualActual: 25_000,
      diasVacacionesCorrespondientesManual: 30,
    });

    const resultado = calcularVacacionesNoGozadas(v, parametros);

    expect(resultado.detalle.diasAnuales).toBe(30);
  });

  it('no redondea la antigüedad hacia arriba por fracción >3 meses (esa regla es del art. 245, no del art. 150)', () => {
    const v = variablesBase({
      fechaIngreso: utc(2006, 10, 2),
      fechaEgreso: utc(2026, 7, 15), // ~19 años y 9 meses: art. 245 redondearía a 20, art. 150 no
      sueldoMensualActual: 25_000,
    });

    const resultado = calcularVacacionesNoGozadas(v, parametros);

    expect(resultado.detalle.anios).toBe(19);
    expect(resultado.detalle.diasAnuales).toBe(28); // tramo "10 a 20 años", no los 35 de "+20 años"
  });

  it('ignora el valor manual del cliente si es menor a lo que corresponde por ley/convenio', () => {
    const v = variablesBase({
      fechaIngreso: utc(2023, 1, 1),
      fechaEgreso: utc(2024, 6, 30),
      sueldoMensualActual: 25_000,
      diasVacacionesCorrespondientesManual: 10, // menor al piso legal (14) para <5 años
    });

    const resultado = calcularVacacionesNoGozadas(v, parametros);

    expect(resultado.detalle.diasAnuales).toBe(14);
  });
});
