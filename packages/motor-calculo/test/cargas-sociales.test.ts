import { describe, expect, it } from 'vitest';
import {
  calcularCargasSociales,
  ConfiguracionCargasSociales,
  ConfiguracionCargasSocialesInvalidaError,
  validarConfiguracionCargasSociales,
} from '../src/cargas-sociales';

const configBase = (overrides: Partial<ConfiguracionCargasSociales> = {}): ConfiguracionCargasSociales => ({
  tipoEmpleador: 'pyme',
  regimenDiferencial: 'comun',
  adicionalDiferencialPorcentaje: 0,
  aplicaFAL: false,
  artPorcentaje: 2.5,
  artCuotaFija: 1200,
  scvoPorEmpleado: 350,
  regimenDetraccion: 'general',
  montoDetraccionPersonalizado: null,
  horasSemanalesJornadaParcial: null,
  ...overrides,
});

describe('calcularCargasSociales', () => {
  it('PyME, actividad común, jornada completa, detracción general, sin SAC', () => {
    const r = calcularCargasSociales(configBase(), { sueldoBruto: 1_500_000, cantidadEmpleados: 1, incluyeSAC: false });

    expect(r.resumen.alicuotaSUSSTotal).toBe(18);
    expect(r.resumen.montoDetraccionAplicado).toBe(7003.68);
    const porConcepto = Object.fromEntries(r.lineas.map((l) => [l.concepto, l]));
    expect(porConcepto.SUSS.baseImponible).toBe(1_492_996.32);
    expect(porConcepto.SUSS.importePorEmpleado).toBe(268_739.34);
    expect(porConcepto.OBRA_SOCIAL.importePorEmpleado).toBe(90_000);
    expect(porConcepto.FAL.importePorEmpleado).toBe(0);
    expect(porConcepto.ART.importePorEmpleado).toBe(38_700);
    expect(porConcepto.SCVO.importePorEmpleado).toBe(350);
    expect(r.totales.cargasTotal).toBe(397_789.34);
    expect(r.totales.costoLaboralTotal).toBe(1_897_789.34);
    expect(r.totales.sobrecostoPorcentaje).toBe(26.52);
  });

  it('gran empresa con régimen diferencial y FAL suma las alícuotas correctas', () => {
    const r = calcularCargasSociales(
      configBase({ tipoEmpleador: 'gran_empresa', regimenDiferencial: 'choferes', adicionalDiferencialPorcentaje: 3, aplicaFAL: true }),
      { sueldoBruto: 1_000_000, cantidadEmpleados: 1, incluyeSAC: false },
    );
    expect(r.resumen.alicuotaSUSSTotal).toBe(23.4);
    expect(r.resumen.alicuotaFAL).toBe(1);
    expect(r.lineas.find((l) => l.concepto === 'FAL')!.importePorEmpleado).toBe(10_000);
  });

  it('prorratea la detracción por jornada parcial y la incrementa 50% con SAC', () => {
    const r = calcularCargasSociales(configBase({ horasSemanalesJornadaParcial: 24 }), {
      sueldoBruto: 500_000,
      cantidadEmpleados: 1,
      incluyeSAC: true,
    });
    expect(r.resumen.factorJornada).toBe(0.5);
    // 7.003,68 × 0,5 × 1,5
    expect(r.resumen.montoDetraccionAplicado).toBe(5252.76);
  });

  it('usa el monto de detracción personalizado y nunca deja la base SUSS negativa', () => {
    const r = calcularCargasSociales(configBase({ regimenDetraccion: 'incrementado', montoDetraccionPersonalizado: 900_000 }), {
      sueldoBruto: 800_000,
      cantidadEmpleados: 1,
      incluyeSAC: false,
    });
    const suss = r.lineas.find((l) => l.concepto === 'SUSS')!;
    expect(suss.baseImponible).toBe(0);
    expect(suss.importePorEmpleado).toBe(0);
  });

  it('sin detracción, la base SUSS es el sueldo bruto completo', () => {
    const r = calcularCargasSociales(configBase({ regimenDetraccion: 'sin_detraccion' }), {
      sueldoBruto: 100_000,
      cantidadEmpleados: 1,
      incluyeSAC: true,
    });
    expect(r.lineas.find((l) => l.concepto === 'SUSS')!.baseImponible).toBe(100_000);
  });

  it('multiplica cada concepto por la cantidad de empleados', () => {
    const uno = calcularCargasSociales(configBase(), { sueldoBruto: 1_500_000, cantidadEmpleados: 1, incluyeSAC: false });
    const diez = calcularCargasSociales(configBase(), { sueldoBruto: 1_500_000, cantidadEmpleados: 10, incluyeSAC: false });
    expect(diez.totales.sueldoBrutoTotal).toBe(15_000_000);
    expect(diez.totales.cargasTotal).toBe(3_977_893.4);
    expect(diez.totales.sobrecostoPorcentaje).toBe(uno.totales.sobrecostoPorcentaje);
  });
});

describe('validarConfiguracionCargasSociales', () => {
  it('rechaza un adicional fuera del rango del régimen', () => {
    expect(() => validarConfiguracionCargasSociales(configBase({ regimenDiferencial: 'construccion', adicionalDiferencialPorcentaje: 6 }))).toThrow(
      ConfiguracionCargasSocialesInvalidaError,
    );
    expect(() => validarConfiguracionCargasSociales(configBase({ regimenDiferencial: 'docentes', adicionalDiferencialPorcentaje: 3 }))).toThrow(
      ConfiguracionCargasSocialesInvalidaError,
    );
    expect(() => validarConfiguracionCargasSociales(configBase({ adicionalDiferencialPorcentaje: 1 }))).toThrow(
      ConfiguracionCargasSocialesInvalidaError,
    );
  });

  it('rechaza horas de jornada parcial inválidas y valores negativos', () => {
    expect(() => validarConfiguracionCargasSociales(configBase({ horasSemanalesJornadaParcial: 48 }))).toThrow();
    expect(() => validarConfiguracionCargasSociales(configBase({ horasSemanalesJornadaParcial: 0 }))).toThrow();
    expect(() => validarConfiguracionCargasSociales(configBase({ artCuotaFija: -1 }))).toThrow();
    expect(() => validarConfiguracionCargasSociales(configBase({ scvoPorEmpleado: -1 }))).toThrow();
  });

  it('acepta una configuración válida', () => {
    expect(() =>
      validarConfiguracionCargasSociales(configBase({ regimenDiferencial: 'docentes', adicionalDiferencialPorcentaje: 2, horasSemanalesJornadaParcial: 24 })),
    ).not.toThrow();
  });
});
