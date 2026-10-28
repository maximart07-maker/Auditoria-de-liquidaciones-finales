import { describe, expect, it } from 'vitest';
import { ALICUOTA_SUSS_BASE, ConfiguracionCargasSociales } from '../src/cargas-sociales';
import {
  calcularControlF931,
  parsearMontoArgentino,
  parsearPeriodoF931,
  parsearReporteF931,
  DESGLOSE_CONTRIBUCIONES_SUSS,
  ReporteF931InvalidoError,
  repartirObraSocialFSR,
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

  it('importa aunque falte la Remuneración 3, que no se usa', () => {
    const sinRem3 = REPORTE.split('\r\n')
      .map((l) => l.split(';').filter((_, i) => i !== 10).join(';'))
      .join('\r\n');
    const r = parsearReporteF931(sinRem3);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(4);
    expect(r.filas[0].remuneracion3).toBe(0);
    expect(r.filas[0].remuneracion4).toBe(4_691_748.47);
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

describe('repartirObraSocialFSR', () => {
  it('el FSR se lleva el 15 % del aporte y de la contribución', () => {
    expect(repartirObraSocialFSR(3)).toEqual({ obraSocial: 2.55, fsr: 0.45 });
    expect(repartirObraSocialFSR(6)).toEqual({ obraSocial: 5.1, fsr: 0.9 });
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
    // SUSS gran empresa 20,40 % sobre Rem. 10, desglosado
    expect(perez.contribuciones.CONTRIB_SIPA).toBe(1_951_675);
    expect(perez.contribuciones.CONTRIB_INSSJP).toBe(284_454.66);
    expect(perez.contribuciones.CONTRIB_FNE).toBe(175_413.7);
    expect(perez.contribuciones.CONTRIB_AAFF).toBe(812_276.07);
    // Obra social 6 % sobre Rem. 8: 5,10 % obra social + 0,90 % FSR
    expect(perez.contribuciones.CONTRIB_OBRA_SOCIAL).toBe(806_312.05);
    expect(perez.contribuciones.CONTRIB_FSR).toBe(142_290.36);
    // ART 2% sobre Rem. 9 + 1.000 fijo
    expect(perez.contribuciones.CONTRIB_ART).toBe(317_200.8);
    expect(perez.contribuciones.CONTRIB_SCVO).toBe(100);

    // El pasante (Rem. 10 = 0) no tiene contribuciones SUSS.
    expect(r.empleados[2].contribuciones.CONTRIB_SIPA).toBe(0);
    expect(r.empleados[2].contribuciones.CONTRIB_AAFF).toBe(0);

    const suss = r.contribuciones.find((c) => c.codigo === 'CONTRIB_SIPA')!;
    expect(suss.baseEtiqueta).toBe('Rem. 10');
    expect(suss.importe).toBe(
      Math.round(r.empleados.reduce((a, e) => a + e.contribuciones.CONTRIB_SIPA, 0) * 100) / 100,
    );
    expect(r.resumen.cantidadEmpleados).toBe(4);
  });

  it('calcula los aportes: SIPA 11 % (Rem. 1), INSSJP 3 % (Rem. 5) y obra social 3 % (Rem. 4)', () => {
    const r = calcularControlF931(config(), filas);
    const perez = r.empleados[0];
    // Rem. 1, 4 y 5 topeadas en 4.691.748,47
    expect(perez.aportes.APORTE_SIPA).toBe(516_092.33);
    expect(perez.aportes.APORTE_INSSJP).toBe(140_752.45);
    // 3 % de obra social: 2,55 % obra social + 0,45 % FSR
    expect(perez.aportes.APORTE_OBRA_SOCIAL).toBe(119_639.59);
    expect(perez.aportes.APORTE_FSR).toBe(21_112.87);
    expect(perez.totalAportes).toBe(797_597.24);

    const sipa = r.aportes.find((a) => a.codigo === 'APORTE_SIPA')!;
    expect(sipa.baseEtiqueta).toBe('Rem. 1');
    expect(sipa.alicuota).toBe(11);
    // Sin la Rem. 1 del pasante (contrato 27).
    expect(sipa.baseTotal).toBe(Math.round((4_691_748.47 * 2 + 1_257_764.32) * 100) / 100);
    expect(sipa.importe).toBe(
      Math.round(r.empleados.reduce((a, e) => a + e.aportes.APORTE_SIPA, 0) * 100) / 100,
    );
    expect(r.aportes).toHaveLength(4);
    expect(r.resumen.totalAportes).toBe(
      Math.round(r.aportes.reduce((a, x) => a + x.importe!, 0) * 100) / 100,
    );
  });

  it('a los pasantes (contrato 27) no les calcula aportes', () => {
    const r = calcularControlF931(config(), filas);
    const pasante = r.empleados.find((e) => e.modalidadContratacion === '27')!;
    expect(pasante.aportes.APORTE_SIPA).toBe(0);
    expect(pasante.aportes.APORTE_OBRA_SOCIAL).toBe(0);
    expect(pasante.aportes.APORTE_FSR).toBe(0);
    expect(pasante.aportes.APORTE_INSSJP).toBe(0);
    expect(pasante.totalAportes).toBe(0);
    const obs = r.observaciones.find((o) => o.titulo === 'Pasantes: régimen de pasantías')!;
    expect(obs.empleados.map((e) => e.legajo)).toEqual(['448']);
  });

  it('a los pasantes solo les calcula contribución de obra social (con FSR), ART y SCVO', () => {
    // Pasante con Rem. 10 informada, para comprobar que igual no lleva SUSS ni FAL.
    const pasante = { ...filas[2], remuneracion10: 936_729.94 };
    const r = calcularControlF931(config({ aplicaFAL: true }), [pasante]);
    const c = r.empleados[0].contribuciones;
    expect([c.CONTRIB_SIPA, c.CONTRIB_INSSJP, c.CONTRIB_FNE, c.CONTRIB_AAFF, c.CONTRIB_FAL]).toEqual([0, 0, 0, 0, 0]);
    // 5,10 % y 0,90 % de Rem. 8; ART 2 % de Rem. 9 + 1.000; SCVO 100
    expect(c.CONTRIB_OBRA_SOCIAL).toBe(47_773.23);
    expect(c.CONTRIB_FSR).toBe(8_430.57);
    expect(c.CONTRIB_ART).toBe(19_734.6);
    expect(c.CONTRIB_SCVO).toBe(100);
  });

  it('al director de S.A. (049) solo le calcula obra social y FSR, ART y SCVO', () => {
    const director = { ...filas[0], legajo: '700', modalidadContratacion: '049' };
    const r = calcularControlF931(config({ aplicaFAL: true }), [director]);
    const e = r.empleados[0];
    expect([e.aportes.APORTE_SIPA, e.aportes.APORTE_INSSJP]).toEqual([0, 0]);
    // 2,55 % y 0,45 % de Rem. 4 (4.691.748,47)
    expect(e.aportes.APORTE_OBRA_SOCIAL).toBe(119_639.59);
    expect(e.aportes.APORTE_FSR).toBe(21_112.87);
    const c = e.contribuciones;
    expect([c.CONTRIB_SIPA, c.CONTRIB_INSSJP, c.CONTRIB_FNE, c.CONTRIB_AAFF, c.CONTRIB_FAL]).toEqual([0, 0, 0, 0, 0]);
    // 5,10 % y 0,90 % de Rem. 8 (15.810.040,15); ART 2 % de Rem. 9 + 1.000; SCVO 100
    expect(c.CONTRIB_OBRA_SOCIAL).toBe(806_312.05);
    expect(c.CONTRIB_FSR).toBe(142_290.36);
    expect(c.CONTRIB_ART).toBe(317_200.8);
    expect(c.CONTRIB_SCVO).toBe(100);
    const titulos = r.observaciones.map((o) => o.titulo);
    expect(titulos).toContain('Contrato 49: director de S.A.');
    expect(titulos).not.toContain('Régimen especial calculado como régimen general');
    expect(r.modalidades[0].tratamiento).toMatch(/^Aportes: solo obra social/);
  });

  it('al contrato 99 solo le calcula la ART', () => {
    const director = { ...filas[0], legajo: '165', modalidadContratacion: '99', remuneracion10: 0, totalDetraer: 0, montoDetraer: 0 };
    const r = calcularControlF931(config({ aplicaFAL: true }), [director]);
    const e = r.empleados[0];
    // ART: 2 % de Rem. 9 + 1.000 fijo; todo lo demás en cero
    expect(e.contribuciones.CONTRIB_ART).toBe(317_200.8);
    expect(e.totalContribuciones).toBe(317_200.8);
    expect(e.totalAportes).toBe(0);
    // Las bases de los conceptos que no le corresponden no suman su remuneración.
    expect(r.contribuciones.find((c) => c.codigo === 'CONTRIB_OBRA_SOCIAL')!.baseTotal).toBe(0);
    expect(r.aportes.find((c) => c.codigo === 'APORTE_INSSJP')!.baseTotal).toBe(0);
    expect(r.contribuciones.find((c) => c.codigo === 'CONTRIB_ART')!.baseTotal).toBe(15_810_040.15);
    expect(r.observaciones.find((o) => o.titulo === 'Contrato 99: solo ART')!.empleados.map((x) => x.legajo)).toEqual(['165']);
  });

  it('resume los empleados por modalidad y marca los regímenes especiales sin reglas propias', () => {
    const becario = { ...filas[1], legajo: '900', cuil: '20555555555', modalidadContratacion: '002' };
    const director = { ...filas[0], legajo: '901', cuil: '20666666666', modalidadContratacion: '99' };
    const desconocido = { ...filas[0], legajo: '902', cuil: '20777777777', modalidadContratacion: '777' };
    const r = calcularControlF931(config(), [...filas, becario, director, desconocido]);
    expect(r.modalidades.map((m) => [m.codigo, m.cantidadEmpleados])).toEqual([
      ['8', 3],
      ['2', 1],
      ['27', 1],
      ['99', 1],
      ['777', 1],
    ]);
    expect(r.modalidades.find((m) => m.codigo === '99')!.descripcion).toMatch(/directores/);
    expect(r.modalidades[0].descripcion).toBe('A tiempo completo - Indeterminado / Permanente');
    expect(r.modalidades.find((m) => m.codigo === '27')!.tratamiento).toMatch(/^Sin aportes/);
    const titulos = Object.fromEntries(r.observaciones.map((o) => [o.titulo, o.empleados.map((e) => e.legajo)]));
    expect(titulos['Régimen especial calculado como régimen general']).toEqual(['900']);
    expect(titulos['Modalidad de contratación fuera del catálogo']).toEqual(['902']);
  });

  it('agrega FAL solo si el cliente lo tiene', () => {
    expect(calcularControlF931(config(), filas).contribuciones.some((c) => c.codigo === 'CONTRIB_FAL')).toBe(false);
    const r = calcularControlF931(config({ aplicaFAL: true }), filas);
    const fal = r.contribuciones.find((c) => c.codigo === 'CONTRIB_FAL')!;
    // Gran empresa 1 % sobre Rem. 10
    expect(fal.baseEtiqueta).toBe('Rem. 10');
    expect(fal.alicuota).toBe(1);
    expect(r.empleados[0].contribuciones.CONTRIB_FAL).toBe(158_030.36);
  });

  it('no muestra la Remuneración 3 entre las bases del panel', () => {
    const r = calcularControlF931(config(), filas);
    expect(r.bases.map((b) => b.etiqueta)).not.toContain('Rem. 3');
    expect(r.bases).toHaveLength(7);
  });

  it('el desglose de cada tipo de empleador suma la alícuota total de SUSS', () => {
    for (const tipo of ['gran_empresa', 'pyme'] as const) {
      const d = DESGLOSE_CONTRIBUCIONES_SUSS[tipo];
      expect(Math.round((d.SIPA + d.INSSJP + d.FNE + d.AAFF) * 100) / 100).toBe(ALICUOTA_SUSS_BASE[tipo]);
    }
  });

  it('suma el adicional del régimen diferencial a SIPA', () => {
    const r = calcularControlF931(config({ regimenDiferencial: 'choferes', adicionalDiferencialPorcentaje: 3 }), filas);
    expect(r.contribuciones.find((c) => c.codigo === 'CONTRIB_SIPA')!.alicuota).toBe(15.35);
    expect(r.contribuciones.find((c) => c.codigo === 'CONTRIB_INSSJP')!.alicuota).toBe(1.8);
  });

  it('PyME: desglosa el 18 % en SIPA 10,77, INSSJP 1,59, FNE 0,94 y AAFF 4,70', () => {
    const r = calcularControlF931(config({ tipoEmpleador: 'pyme' }), filas);
    const alicuotas = Object.fromEntries(r.contribuciones.map((c) => [c.codigo, c.alicuota]));
    expect(alicuotas).toMatchObject({ CONTRIB_SIPA: 10.77, CONTRIB_INSSJP: 1.59, CONTRIB_FNE: 0.94, CONTRIB_AAFF: 4.7 });
  });

  it('sin detracción toma la Rem. 2 para las contribuciones SUSS', () => {
    const r = calcularControlF931(config({ regimenDetraccion: 'sin_detraccion' }), filas);
    expect(r.contribuciones[0].baseEtiqueta).toBe('Rem. 2');
  });

  it('marca la detracción distinta a la del cliente y los empleados sin detracción', () => {
    const r = calcularControlF931(config(), filas);
    const titulos = Object.fromEntries(r.observaciones.map((o) => [o.titulo, o.empleados.map((e) => e.legajo)]));
    expect(titulos['Detracción distinta a la configurada para el cliente']).toEqual(['460']);
    // El 448 es pasante: tiene su propia observación.
    expect(titulos['Empleados sin detracción']).toBeUndefined();
    expect(titulos['La base con detracción no cierra']).toBeUndefined();
  });

  it('detecta una Rem. 10 que no cierra con la detracción', () => {
    const alterada = [{ ...filas[0], remuneracion10: 15_000_000 }];
    const r = calcularControlF931(config(), alterada);
    expect(r.observaciones.map((o) => o.titulo)).toContain('La base con detracción no cierra');
  });
});
