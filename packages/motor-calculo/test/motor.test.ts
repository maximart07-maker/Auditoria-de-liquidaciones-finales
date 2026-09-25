import { describe, expect, it } from 'vitest';
import { calcularLiquidacionSistema } from '../src/motor';
import { variablesBase, utc } from './fixtures';

describe('calcularLiquidacionSistema', () => {
  it('en un despido sin causa incluye indemnización, preaviso, integración y SAC/vacaciones', () => {
    const v = variablesBase({ tipoExtincion: 'despido_sin_causa', preavisoOtorgado: false });

    const liquidacion = calcularLiquidacionSistema(v);
    const codigos = liquidacion.rubros.map((r) => r.rubro);

    expect(codigos).toContain('IND_ANTIGUEDAD');
    expect(codigos).toContain('PREAVISO');
    expect(codigos).toContain('SAC_PROP');
    expect(liquidacion.total).toBeGreaterThan(0);
  });

  it('en una renuncia no incluye indemnización ni preaviso', () => {
    const v = variablesBase({ tipoExtincion: 'renuncia' });

    const liquidacion = calcularLiquidacionSistema(v);
    const codigos = liquidacion.rubros.map((r) => r.rubro);

    expect(codigos).not.toContain('IND_ANTIGUEDAD');
    expect(codigos).not.toContain('PREAVISO');
    expect(codigos).not.toContain('INTEGRACION_MES');
    expect(codigos).toContain('SAC_PROP');
  });

  it('incluye SAC_S_VAC_ANTERIORES cuando hay días de vacaciones pendientes de períodos anteriores', () => {
    const v = variablesBase({ diasVacacionesPendientesPeriodosAnteriores: 10, sueldoMensualActual: 100_000 });

    const liquidacion = calcularLiquidacionSistema(v);
    const codigos = liquidacion.rubros.map((r) => r.rubro);
    const vacAnteriores = liquidacion.rubros.find((r) => r.rubro === 'VAC_NO_GOZADAS_ANTERIORES')!;
    const sacAnteriores = liquidacion.rubros.find((r) => r.rubro === 'SAC_S_VAC_ANTERIORES')!;

    expect(codigos).toContain('VAC_NO_GOZADAS_ANTERIORES');
    expect(codigos).toContain('SAC_S_VAC_ANTERIORES');
    expect(sacAnteriores.monto).toBeCloseTo(vacAnteriores.monto / 12, 2);
  });

  it('no incluye SAC_S_VAC_ANTERIORES cuando no hay días pendientes de períodos anteriores', () => {
    const v = variablesBase({ diasVacacionesPendientesPeriodosAnteriores: 0 });

    const liquidacion = calcularLiquidacionSistema(v);

    expect(liquidacion.rubros.map((r) => r.rubro)).not.toContain('SAC_S_VAC_ANTERIORES');
  });

  it('lanza un error si no hay parámetros normativos cargados para el convenio', () => {
    const v = variablesBase({ convenioColectivo: 'CONVENIO_INEXISTENTE', fechaEgreso: utc(2023, 5, 15) });

    expect(() => calcularLiquidacionSistema(v)).toThrow(/parámetros normativos/i);
  });
});
