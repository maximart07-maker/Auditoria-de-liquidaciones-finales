import { VariablesCaso } from '../src/tipos';

export function utc(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia));
}

export function variablesBase(overrides: Partial<VariablesCaso> = {}): VariablesCaso {
  return {
    fechaIngreso: utc(2015, 1, 10),
    fechaEgreso: utc(2023, 5, 15),
    tipoExtincion: 'despido_sin_causa',
    mejorRemuneracionMensualNormalYHabitual: 100_000,
    mejorRemuneracionSemestral: 100_000,
    sueldoMensualActual: 100_000,
    diasVacacionesGozadosEnElAnio: 0,
    diasVacacionesCorrespondientesManual: 0,
    diasVacacionesPendientesPeriodosAnteriores: 0,
    preavisoOtorgado: false,
    convenioColectivo: 'GENERICO',
    ...overrides,
  };
}
