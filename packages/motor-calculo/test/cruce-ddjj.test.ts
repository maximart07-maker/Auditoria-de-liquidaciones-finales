import { describe, expect, it } from 'vitest';
import { ConfiguracionCargasSociales } from '../src/cargas-sociales';
import { calcularControlF931, FilaReporteF931 } from '../src/control-f931';
import { cruzarConDDJJ, NominaDDJJInvalidaError, parsearNominaDDJJ } from '../src/cruce-ddjj';

const TITULOS =
  'CUIL;Apellido y Nombre;Obra Social;Corresponde Reducción?;Con Cobertura S.C.V.O.?;Situación;Condición;Actividad;Modalidad de Contrato;Remuneración Total;Remuneración 1;Remuneración 2;Remuneración 3;Remuneración 4;Remuneración 5;Remuneración 8;Remuneración 9;Remuneración 10;Importe a detraer;Cantidad de días trabajados;Conceptos no remun.;Contribución Previsional;Contribución PAMI;Fondo Nac. de Empleo;Contribución ANSSAL;Contribución Asig. Familiares;* porcentaje aplicado;Aporte Previsional;Aporte PAMI;Aporte ANSSAL;* porcentaje aplicado;Contribución OS;Aporte OS';

// Empleado de 1.000.000 con detracción 7.003,68, PyME: importes calculados a mano.
const renglon = (cuil: string, nombre: string, modalidad: string, remTotal = '1.000.000,40', noRem = '0,40') =>
  [cuil, nombre, '123', 'No', 'Si', '1', '1', '1', modalidad, remTotal, '1.000.000', '1.000.000', '1.000.000', '1.000.000', '1.000.000', '1.000.000', '1.000.000', '992.996,32', '7.003,68', '30', noRem,
    // SIPA 10,77 %, PAMI 1,59 %, FNE 0,94 % de Rem. 10; FSR 0,90 % de Rem. 8; AAFF 4,70 %
    '106.945,70', '15.788,64', '9.334,17', '9.000', '46.670,83', '18', '110.000', '30.000', '4.500', '3', '51.000', '25.500'].join(';');

const archivo = (renglones: string[]) =>
  ['CUIT:;30-11111111-1;;', 'Período;09 2026;;', 'Secuencia:;0 - Original;;', 'Contribuyente:;EMPRESA DE PRUEBA SA;;', TITULOS, ...renglones, ''].join('\r\n');

const filaReporte = (cuil: string, nombre: string, legajo: string, modalidad = '8'): FilaReporteF931 => ({
  periodo: new Date(Date.UTC(2026, 8, 1)),
  legajo,
  nombre,
  cuil,
  modalidadContratacion: modalidad,
  condicion: '1',
  convenio: '0',
  remuneracionTotal: 1_000_000,
  remuneracion1: 1_000_000,
  remuneracion2: 1_000_000,
  remuneracion3: 1_000_000,
  remuneracion4: 1_000_000,
  remuneracion5: 1_000_000,
  remuneracion8: 1_000_000,
  remuneracion9: 1_000_000,
  remuneracion10: 992_996.32,
  montoDetraer: 7003.68,
  montoDetraerSAC: 0,
  totalDetraer: 7003.68,
});

const pyme: ConfiguracionCargasSociales = {
  tipoEmpleador: 'pyme',
  regimenDiferencial: 'comun',
  adicionalDiferencialPorcentaje: 0,
  aplicaFAL: false,
  artPorcentaje: 0,
  artCuotaFija: 0,
  scvoPorEmpleado: 0,
  regimenDetraccion: 'general',
  montoDetraccionPersonalizado: null,
  horasSemanalesJornadaParcial: null,
};

describe('parsearNominaDDJJ', () => {
  it('lee la cabecera y los renglones por CUIL', () => {
    const n = parsearNominaDDJJ(archivo([renglon('20111111111', 'JUAN PEREZ', '008')]));
    expect(n.cuit).toBe('30111111111');
    expect(n.periodo).toEqual(new Date(Date.UTC(2026, 8, 1)));
    expect(n.secuencia).toBe('0 - Original');
    expect(n.contribuyente).toBe('EMPRESA DE PRUEBA SA');
    expect(n.filas[0]).toMatchObject({ cuil: '20111111111', modalidadContratacion: '8', remuneracion10: 992_996.32, importeDetraer: 7003.68 });
    expect(n.filas[0].importes).toMatchObject({ CONTRIB_SIPA: 106_945.7, APORTE_SIPA: 110_000, CONTRIB_OBRA_SOCIAL: 51_000, APORTE_FSR: 4_500 });
  });

  it('rechaza un archivo sin la fila de títulos', () => {
    expect(() => parsearNominaDDJJ('Período;09 2026\nfoo;bar')).toThrow(NominaDDJJInvalidaError);
  });
});

describe('cruzarConDDJJ', () => {
  const reporte = [filaReporte('20111111111', 'Pérez, Juan', '1'), filaReporte('20222222222', 'Gómez, Ana', '2'), filaReporte('20333333333', 'López, Pedro', '3')];
  const control = calcularControlF931(pyme, reporte);

  it('sin diferencias cuando coinciden bases, modalidad e importes (con centavos de redondeo en no remunerativos)', () => {
    const n = parsearNominaDDJJ(archivo(reporte.map((r) => renglon(r.cuil, r.nombre, '8'))));
    const x = cruzarConDDJJ(reporte, control, n.filas);
    expect(x.empleados).toEqual([]);
    expect(x.resumen).toMatchObject({ sinDiferencias: 3, conDiferencias: 0, remuneracionTotalPorRedondeo: 3 });
  });

  it('informa las diferencias por CUIL', () => {
    const n = parsearNominaDDJJ(
      archivo([
        renglon('20111111111', 'JUAN PEREZ', '22'),
        renglon('20222222222', 'ANA GOMEZ', '8', '1.050.000', '50.000'),
        renglon('20444444444', 'SOLO DDJJ', '8'),
      ]),
    );
    const x = cruzarConDDJJ(reporte, control, n.filas);
    const por = Object.fromEntries(x.empleados.map((e) => [e.cuil, e.diferencias.map((d) => [d.concepto, d.valorSistema, d.valorDDJJ, d.diferencia])]));
    expect(por['20111111111']).toEqual([['Modalidad de contratación', '8', '22', null]]);
    // 50.000 de no remunerativos no es redondeo: se informa.
    expect(por['20222222222']).toEqual([['Remuneración Total', 1_000_000, 1_050_000, 50_000]]);
    expect(por['20333333333']).toEqual([['No está en la DDJJ', 'En el reporte', null, null]]);
    expect(por['20444444444']).toEqual([['Solo está en la DDJJ', null, 'Declarado', null]]);
    expect(x.resumen).toMatchObject({ conDiferencias: 2, sinDiferencias: 0, soloEnReporte: 1, soloEnDDJJ: 1 });
    const modalidad = x.empleados.find((e) => e.cuil === '20111111111')!.diferencias[0];
    expect(modalidad.detalle).toBe(
      'Sistema: A tiempo completo - Indeterminado / Permanente · DDJJ: A tiempo completo - Determinado (plazo fijo)',
    );
    expect(x.empleados.find((e) => e.cuil === '20444444444')!.diferencias[0].detalle).toMatch(/^Situación de revista 1/);
  });

  it('marca a los pasantes declarados con cobertura de SCVO', () => {
    const pasante = { ...filaReporte('20555555555', 'Díaz, Laura', '5', '27') };
    const control27 = calcularControlF931(pyme, [pasante]);
    const conSCVO = renglon('20555555555', 'LAURA DIAZ', '027');
    const sinSCVO = conSCVO.replace(';No;Si;', ';No;No;');
    expect(parsearNominaDDJJ(archivo([conSCVO])).filas[0].coberturaSCVO).toBe(true);
    expect(parsearNominaDDJJ(archivo([sinSCVO])).filas[0].coberturaSCVO).toBe(false);

    const x = cruzarConDDJJ([pasante], control27, parsearNominaDDJJ(archivo([conSCVO])).filas);
    const scvo = x.empleados[0].diferencias.find((d) => d.grupo === 'declaracion')!;
    expect(scvo).toMatchObject({ concepto: 'Cobertura SCVO declarada a un pasante', valorSistema: 'No corresponde', valorDDJJ: 'Si' });
    expect(x.resumen.pasantesConSCVO).toBe(1);
    expect(x.resumen.coberturaSCVOSinDato).toBe(false);

    const y = cruzarConDDJJ([pasante], control27, parsearNominaDDJJ(archivo([sinSCVO])).filas);
    expect(y.empleados.flatMap((e) => e.diferencias).some((d) => d.grupo === 'declaracion')).toBe(false);
    expect(y.resumen.pasantesConSCVO).toBe(0);

    // Un empleado común con SCVO no se marca.
    const comun = cruzarConDDJJ([reporte[0]], calcularControlF931(pyme, [reporte[0]]), parsearNominaDDJJ(archivo([renglon('20111111111', 'JUAN PEREZ', '8')])).filas);
    expect(comun.resumen.pasantesConSCVO).toBe(0);
  });

  it('avisa si la nómina guardada no trae la cobertura de SCVO (importada antes de este control)', () => {
    const vieja = parsearNominaDDJJ(archivo([renglon('20111111111', 'JUAN PEREZ', '8')])).filas.map(({ coberturaSCVO: _c, ...resto }) => resto);
    const x = cruzarConDDJJ([reporte[0]], calcularControlF931(pyme, [reporte[0]]), vieja);
    expect(x.resumen.coberturaSCVOSinDato).toBe(true);
  });

  it('compara los importes calculados por la app contra los de ARCA', () => {
    const conOS = renglon('20111111111', 'JUAN PEREZ', '8').replace(/;51\.000;25\.500$/, ';60.000;25.500');
    const x = cruzarConDDJJ([reporte[0]], calcularControlF931(pyme, [reporte[0]]), parsearNominaDDJJ(archivo([conOS])).filas);
    expect(x.empleados[0].diferencias).toEqual([
      { grupo: 'importe', concepto: 'Contribución Obra Social', valorSistema: 51_000, valorDDJJ: 60_000, diferencia: 9_000 },
    ]);
    expect(x.totalesImportes.find((t) => t.codigo === 'CONTRIB_OBRA_SOCIAL')!.diferencia).toBe(9_000);
  });
});
