import { describe, expect, it } from 'vitest';
import { clasificarSeveridad, generarHallazgos } from '../src/comparacion';
import { LiquidacionCalculada, RubroDeclarado } from '../src/tipos';

describe('clasificarSeveridad', () => {
  it('clasifica alta por porcentaje alto', () => {
    expect(clasificarSeveridad(5_000, 15)).toBe('alta');
  });

  it('clasifica alta por monto absoluto aunque el porcentaje sea bajo', () => {
    expect(clasificarSeveridad(150_000, 1)).toBe('alta');
  });

  it('clasifica media y baja según el porcentaje', () => {
    expect(clasificarSeveridad(1_000, 5)).toBe('media');
    expect(clasificarSeveridad(100, 1)).toBe('baja');
  });
});

describe('generarHallazgos', () => {
  it('compara rubros declarados vs. calculados y calcula la diferencia', () => {
    const declarado: RubroDeclarado[] = [
      { rubro: 'IND_ANTIGUEDAD', monto: 800_000 },
      { rubro: 'SAC_PROP', monto: 10_000 },
    ];
    const calculado: LiquidacionCalculada = {
      origen: 'sistema',
      fechaCalculo: new Date(),
      total: 910_000,
      rubros: [
        { rubro: 'IND_ANTIGUEDAD', monto: 900_000, detalle: {} },
        { rubro: 'SAC_PROP', monto: 10_000, detalle: {} },
      ],
    };

    const hallazgos = generarHallazgos(declarado, calculado);
    const indemnizacion = hallazgos.find((h) => h.rubro === 'IND_ANTIGUEDAD')!;
    const sac = hallazgos.find((h) => h.rubro === 'SAC_PROP')!;

    expect(indemnizacion.diferencia).toBe(100_000);
    expect(indemnizacion.severidad).toBe('alta');
    expect(sac.diferencia).toBe(0);
    expect(sac.severidad).toBe('baja');
  });

  it('incluye rubros calculados que la empresa no declaró', () => {
    const declarado: RubroDeclarado[] = [];
    const calculado: LiquidacionCalculada = {
      origen: 'sistema',
      fechaCalculo: new Date(),
      total: 50_000,
      rubros: [{ rubro: 'VAC_NO_GOZADAS', monto: 50_000, detalle: {} }],
    };

    const hallazgos = generarHallazgos(declarado, calculado);

    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0].montoDeclarado).toBe(0);
    expect(hallazgos[0].porcentajeDiferencia).toBe(100);
  });
});
