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

  it('lanza un error si no hay parámetros normativos cargados para el convenio', () => {
    const v = variablesBase({ convenioColectivo: 'CONVENIO_INEXISTENTE', fechaEgreso: utc(2023, 5, 15) });

    expect(() => calcularLiquidacionSistema(v)).toThrow(/parámetros normativos/i);
  });
});
