import { describe, expect, it } from 'vitest';
import { calcularIndemnizacionAntiguedad } from '../src/rubros/indemnizacion-antiguedad';
import { conTopeIndemnizatorio, crearRepositorioEnMemoria } from '../src/parametros';
import { TopeIndemnizatorioInvalidoError, validarTopeIndemnizatorio } from '../src/validaciones/tope-indemnizatorio';
import { variablesBase, utc } from './fixtures';

describe('conTopeIndemnizatorio', () => {
  const repositorioBase = crearRepositorioEnMemoria();

  it('reemplaza el tope del cliente pero conserva el resto de los parámetros normativos', () => {
    const repositorioCliente = conTopeIndemnizatorio(repositorioBase, 2_500_000);
    const parametros = repositorioCliente.obtenerVigentes('GENERICO', utc(2023, 5, 15));

    expect(parametros.topeIndemnizatorio).toBe(2_500_000);
    expect(parametros.divisorSAC).toBe(repositorioBase.obtenerVigentes('GENERICO', utc(2023, 5, 15)).divisorSAC);
  });

  it('nunca permite eludir el piso del 67% de la MRMNH (doctrina Vizzoti) aunque el cliente configure un tope muy bajo', () => {
    const repositorioCliente = conTopeIndemnizatorio(repositorioBase, 1);
    const parametros = repositorioCliente.obtenerVigentes('GENERICO', utc(2023, 5, 15));
    const v = variablesBase({
      fechaIngreso: utc(2023, 1, 1),
      fechaEgreso: utc(2023, 3, 1), // menos de 1 año => antigüedad mínima de 1 año
      mejorRemuneracionMensualNormalYHabitual: 100_000,
    });

    const resultado = calcularIndemnizacionAntiguedad(v, parametros);

    // Con un tope de $1 sin piso el resultado sería ~$1; el piso Vizzoti garantiza
    // al menos el 67% de la MRMNH por cada año de antigüedad (mínimo 1 año).
    expect(resultado.detalle.base).toBeCloseTo(67_000, 2);
    expect(resultado.monto).toBeCloseTo(67_000, 2);
  });

  it('un tope alto configurado por el cliente no reduce el monto por debajo del piso', () => {
    const repositorioCliente = conTopeIndemnizatorio(repositorioBase, 5_000_000);
    const parametros = repositorioCliente.obtenerVigentes('GENERICO', utc(2023, 5, 15));
    const v = variablesBase({
      fechaIngreso: utc(2015, 1, 10),
      fechaEgreso: utc(2023, 5, 15),
      mejorRemuneracionMensualNormalYHabitual: 100_000,
    });

    const resultado = calcularIndemnizacionAntiguedad(v, parametros);

    expect(resultado.detalle.base).toBeCloseTo(100_000, 2);
    expect(resultado.monto).toBeCloseTo(900_000, 2);
  });
});

describe('validarTopeIndemnizatorio', () => {
  it('acepta un valor positivo', () => {
    expect(() => validarTopeIndemnizatorio(1_500_000)).not.toThrow();
  });

  it('rechaza cero, negativos y valores no finitos', () => {
    expect(() => validarTopeIndemnizatorio(0)).toThrow(TopeIndemnizatorioInvalidoError);
    expect(() => validarTopeIndemnizatorio(-100)).toThrow(TopeIndemnizatorioInvalidoError);
    expect(() => validarTopeIndemnizatorio(Number.NaN)).toThrow(TopeIndemnizatorioInvalidoError);
  });
});
