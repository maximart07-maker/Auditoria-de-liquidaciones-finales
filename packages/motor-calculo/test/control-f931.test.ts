import { describe, expect, it } from 'vitest';
import { ConfiguracionCargasSociales } from '../src/cargas-sociales';
import {
  calcularControlF931,
  parsearMontoArgentino,
  parsearPeriodoF931,
  parsearReporteF931,
  ReporteF931InvalidoError,
} from '../src/control-f931';

// Encabezado tal como lo exporta el sistema de liquidación (con acentos).
const ENCABEZADO =
  'Período;Empleado;Apellido y Nombre;CUIL;Contrato;Condición SIJP;Convenio Colectivo;Remuneración Total;Remuneración 1;Remuneración 2;Remuneración 3;Remuneración 4;Remuneración 5;Remuneración 8;Remuneración 9;Remuneración 10;Monto a detraer;Monto a detraer SAC;Total Importe a detraer';

const REPORTE = [
  ENCABEZADO,
  'sept-26;5;Pérez , Juan Carlos;20-11111111-1;8;1;0;15.810.040,15;4.691.748,47;15.810.040,15;4.691.748,47;4.691.748,47;4.691.748,47;15.810.040,15;15.810.040,15;15.803.036,47;7.003,68;0;7.003,68',
  'sept-26;38;Gómez , Ana María;27-22222222-2;8;1;1;5.304.561,30;4.691.748,47;5.244.535,36;4.691.748,47;4.691.748,47;4.691.748,47;5.244.535,36;5.304.561,30;5.237.531,68;7.003,68;0;7.003,68',
  'sept-26;448;López , Pedro;20-33333333-3;27;1;0;936.729,94;936.729,94;936.729,94;936.729,94;936.729,94;936.729,94;936.729,94;936.729,94;0;0;0;0',
  'sept-26;460;Díaz , Laura;27-44444444-4;8;1;1;1.257.764,32;1.257.764,32;1.257.764,32;1.257.764,32;1.257.764,32;1.257.764,32;1.257.764,32;1.257.764,32;1.253.795,57;3.968,75;0;3.968,75',
  '',
].join('\r\n');

const config = (overrides: Partial<ConfiguracionCargasSociales> = {}): ConfiguracionCargasSociales => ({
  tipoEmpleador: 'gran_empresa',
  regimenDiferencial: 'comun',
  adicionalDiferencialPorcentaje: 0,
  aplicaFAL: false,
  artPorcentaje: 2,
  artCuotaFija: 1000,
  scvoPorEmpleado: 100,
  regimenDetraccion: 'general',
  montoDetraccionPersonalizado: null,
  horasSemanalesJornadaParcial: null,
  ...overrides,
});

describe('parsearReporteF931', () => {
  it('lee el reporte del sistema de liquidación', () => {
    const { filas, errores } = parsearReporteF931(REPORTE);
    expect(errores).toEqual([]);
    expect(filas).toHaveLength(4);
    expect(filas[0]).toMatchObject({
      periodo: new Date(Date.UTC(2026, 8, 1)),
      legajo: '5',
      nombre: 'Pérez, Juan Carlos',
      cuil: '20111111111',
      modalidadContratacion: '8',
      remuneracionTotal: 15_810_040.15,
      remuneracion1: 4_691_748.47,
      remuneracion10: 15_803_036.47,
      totalDetraer: 7003.68,
    });
  });

  it('tolera encabezados con acentos rotos por la codificación', () => {
    const roto = REPORTE.replace(/é|ó/g, '�');
    expect(parsearReporteF931(roto).filas).toHaveLength(4);
  });

  it('informa columnas faltantes', () => {
    expect(() => parsearReporteF931('Período,CUIL\nsept-26,20-1')).toThrow(ReporteF931InvalidoError);
  });

  it('reporta renglones inválidos sin frenar el resto', () => {
    const conError = REPORTE.replace('20-33333333-3', 'xx');
    const r = parsearReporteF931(conError);
    expect(r.filas).toHaveLength(3);
    expect(r.errores[0]).toMatch(/Renglón 4: CUIL/);
  });
});

describe('formatos', () => {
  it('montos argentinos', () => {
    expect(parsearMontoArgentino('15.810.040,15')).toBe(15_810_040.15);
    expect(parsearMontoArgentino('0')).toBe(0);
    expect(parsearMontoArgentino('abc')).toBeNull();
  });
  it('períodos', () => {
    expect(parsearPeriodoF931('sept-26')).toEqual(new Date(Date.UTC(2026, 8, 1)));
    expect(parsearPeriodoF931('dic-2025')).toEqual(new Date(Date.UTC(2025, 11, 1)));
    expect(parsearPeriodoF931('09/2026')).toEqual(new Date(Date.UTC(2026, 8, 1)));
    expect(parsearPeriodoF931('2026-09')).toEqual(new Date(Date.UTC(2026, 8, 1)));
    expect(parsearPeriodoF931('foo-26')).toBeNull();
  });
});

describe('calcularControlF931', () => {
  const { filas } = parsearReporteF931(REPORTE);

  it('calcula las contribuciones con la configuración del cliente sobre las bases del reporte', () => {
    const r = calcularControlF931(config(), filas);
    const perez = r.empleados[0];
    // SUSS gran empresa 20,40% sobre Rem. 10
    expect(perez.contribuciones.CONTRIB_SUSS).toBe(3_223_819.44);
    // Obra social 6% sobre Rem. 8
    expect(perez.contribuciones.CONTRIB_OBRA_SOCIAL).toBe(948_602.41);
    // ART 2% sobre Rem. 9 + 1.000 fijo
    expect(perez.contribuciones.CONTRIB_ART).toBe(317_200.8);
    expect(perez.contribuciones.CONTRIB_SCVO).toBe(100);

    // El pasante (Rem. 10 = 0) no tiene contribuciones SUSS.
    expect(r.empleados[2].contribuciones.CONTRIB_SUSS).toBe(0);

    const suss = r.contribuciones.find((c) => c.codigo === 'CONTRIB_SUSS')!;
    expect(suss.baseEtiqueta).toBe('Rem. 10');
    expect(suss.importe).toBe(
      Math.round(r.empleados.reduce((a, e) => a + e.contribuciones.CONTRIB_SUSS, 0) * 100) / 100,
    );
    expect(r.resumen.cantidadEmpleados).toBe(4);
  });

  it('muestra los aportes con su base pero sin calcular', () => {
    const r = calcularControlF931(config(), filas);
    const sipa = r.aportes.find((a) => a.codigo === 'APORTE_SIPA')!;
    expect(sipa.baseEtiqueta).toBe('Rem. 1');
    expect(sipa.baseTotal).toBe(Math.round((4_691_748.47 * 2 + 936_729.94 + 1_257_764.32) * 100) / 100);
    expect(sipa.importe).toBeNull();
    expect(sipa.pendiente).not.toBeNull();
  });

  it('agrega FAL solo si el cliente lo tiene', () => {
    expect(calcularControlF931(config(), filas).contribuciones.some((c) => c.codigo === 'CONTRIB_FAL')).toBe(false);
    expect(calcularControlF931(config({ aplicaFAL: true }), filas).contribuciones.some((c) => c.codigo === 'CONTRIB_FAL')).toBe(true);
  });

  it('sin detracción toma la Rem. 2 para las contribuciones SUSS', () => {
    const r = calcularControlF931(config({ regimenDetraccion: 'sin_detraccion' }), filas);
    expect(r.contribuciones[0].baseEtiqueta).toBe('Rem. 2');
  });

  it('marca la detracción distinta a la del cliente y los empleados sin detracción', () => {
    const r = calcularControlF931(config(), filas);
    const titulos = Object.fromEntries(r.observaciones.map((o) => [o.titulo, o.empleados.map((e) => e.legajo)]));
    expect(titulos['Detracción distinta a la configurada para el cliente']).toEqual(['460']);
    expect(titulos['Empleados sin detracción']).toEqual(['448']);
    expect(titulos['La base con detracción no cierra']).toBeUndefined();
  });

  it('detecta una Rem. 10 que no cierra con la detracción', () => {
    const alterada = [{ ...filas[0], remuneracion10: 15_000_000 }];
    const r = calcularControlF931(config(), alterada);
    expect(r.observaciones.map((o) => o.titulo)).toContain('La base con detracción no cierra');
  });
});
