import { describe, expect, it } from 'vitest';
import { calcularIndemnizacionAntiguedad } from '../src/rubros/indemnizacion-antiguedad';
import { crearRepositorioEnMemoria } from '../src/parametros';
import { variablesBase, utc } from './fixtures';

const parametrosDefault = crearRepositorioEnMemoria().obtenerVigentes('GENERICO', utc(2023, 5, 15));

describe('calcularIndemnizacionAntiguedad', () => {
  it('computa fracción mayor a 3 meses como año completo', () => {
    const v = variablesBase({ fechaIngreso: utc(2015, 1, 10), fechaEgreso: utc(2023, 5, 15) });
    const resultado = calcularIndemnizacionAntiguedad(v, parametrosDefault);

    expect(resultado.detalle.anios).toBe(9);
    expect(resultado.monto).toBeCloseTo(900_000, 2);
  });

  it('no suma año extra con fracción de exactamente 3 meses', () => {
    const v = variablesBase({ fechaIngreso: utc(2020, 1, 10), fechaEgreso: utc(2023, 4, 10) });
    const resultado = calcularIndemnizacionAntiguedad(v, parametrosDefault);

    expect(resultado.detalle.anios).toBe(3);
  });

  it('aplica el piso del 67% del MRMNH cuando el tope convencional es muy bajo', () => {
    const repositorio = crearRepositorioEnMemoria([
      {
        convenioColectivo: 'TOPE_BAJO',
        vigenciaDesde: utc(2020, 1, 1),
        vigenciaHasta: null,
        topeIndemnizatorio: 10_000,
        divisorSAC: 12,
        divisorVacaciones: 25,
        diasVacacionesPorAntiguedad: { hasta5Anios: 14, de5a10Anios: 21, de10a20Anios: 28, masDe20Anios: 35 },
      },
    ]);
    const parametros = repositorio.obtenerVigentes('TOPE_BAJO', utc(2023, 5, 15));
    const v = variablesBase({ convenioColectivo: 'TOPE_BAJO', mejorRemuneracionMensualNormalYHabitual: 100_000 });

    const resultado = calcularIndemnizacionAntiguedad(v, parametros);

    expect(resultado.detalle.base).toBeCloseTo(67_000, 2);
  });

  it('respeta el mínimo de un año de antigüedad', () => {
    const v = variablesBase({ fechaIngreso: utc(2023, 1, 1), fechaEgreso: utc(2023, 3, 1) });
    const resultado = calcularIndemnizacionAntiguedad(v, parametrosDefault);

    expect(resultado.monto).toBeCloseTo(v.mejorRemuneracionMensualNormalYHabitual, 2);
  });
});
