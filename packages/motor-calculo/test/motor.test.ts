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

  it('en una renuncia no incluye indemnización, preaviso ni multas', () => {
    const v = variablesBase({ tipoExtincion: 'renuncia' });

    const liquidacion = calcularLiquidacionSistema(v);
    const codigos = liquidacion.rubros.map((r) => r.rubro);

    expect(codigos).not.toContain('IND_ANTIGUEDAD');
    expect(codigos).not.toContain('PREAVISO');
    expect(codigos).not.toContain('INTEGRACION_MES');
    expect(codigos).not.toContain('MULTA_ART2_25323');
    expect(codigos).toContain('SAC_PROP');
  });

  it('la multa art. 2 ley 25.323 solo aparece con intimación de pago incumplida en un despido sin causa', () => {
    const sinIntimacion = calcularLiquidacionSistema(variablesBase({ intimacionPagoCursada: false }));
    const conIntimacion = calcularLiquidacionSistema(variablesBase({ intimacionPagoCursada: true }));

    expect(sinIntimacion.rubros.map((r) => r.rubro)).not.toContain('MULTA_ART2_25323');
    expect(conIntimacion.rubros.map((r) => r.rubro)).toContain('MULTA_ART2_25323');
  });

  it('la multa art. 1 ley 25.323 no se aplica en una renuncia aunque haya registración deficiente', () => {
    const v = variablesBase({ tipoExtincion: 'renuncia', registracionDeficiente: true });

    const liquidacion = calcularLiquidacionSistema(v);

    expect(liquidacion.rubros.map((r) => r.rubro)).not.toContain('MULTA_ART1_25323');
  });

  it('lanza un error si no hay parámetros normativos cargados para el convenio', () => {
    const v = variablesBase({ convenioColectivo: 'CONVENIO_INEXISTENTE', fechaEgreso: utc(2023, 5, 15) });

    expect(() => calcularLiquidacionSistema(v)).toThrow(/parámetros normativos/i);
  });
});
