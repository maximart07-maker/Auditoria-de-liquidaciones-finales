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

  it('computa la antigüedad al 31 de diciembre del año de egreso, no a la fecha de egreso (art. 150 LCT)', () => {
    // Ingresó el 1/3/2015, se va el 15/1/2025: a esa fecha tiene 9 años (no
    // cumplió aniversario todavía), pero para el 31/12/2025 ya cumple 10 —
    // el art. 150 LCT manda usar la antigüedad que "tendría... al 31 de
    // diciembre del año que correspondan", no la real a la fecha de egreso.
    const v = variablesBase({
      fechaIngreso: utc(2015, 3, 1),
      fechaEgreso: utc(2025, 1, 15),
      sueldoMensualActual: 25_000,
    });

    const resultado = calcularVacacionesNoGozadas(v, parametros);

    expect(resultado.detalle.anios).toBe(10);
    expect(resultado.detalle.diasAnuales).toBe(28); // tramo "10 a 20 años", no los 21 de "5 a 10 años"
  });

  it('no redondea la antigüedad hacia arriba por fracción >3 meses (esa regla es del art. 245, no del art. 150)', () => {
    const v = variablesBase({
      fechaIngreso: utc(2006, 10, 2),
      fechaEgreso: utc(2026, 7, 15), // ~19 años y 9 meses a la fecha de egreso
      sueldoMensualActual: 25_000,
    });

    const resultado = calcularVacacionesNoGozadas(v, parametros);

    // Al 31/12/2026 ya cumplió 20 años (aniversario el 2/10) — el resultado
    // coincide con lo que daría la regla de redondeo del art. 245, pero por
    // el motivo correcto (antigüedad al 31/12, no por redondear una fracción).
    expect(resultado.detalle.anios).toBe(20);
    expect(resultado.detalle.diasAnuales).toBe(35);
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
