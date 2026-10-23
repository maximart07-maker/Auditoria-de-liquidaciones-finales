/**
 * Reglas de validación para la tabla de días de vacaciones por antigüedad que
 * un cliente puede configurar por tramo (p.ej. porque el convenio colectivo
 * aplicable a sus empleados otorga más días que el genérico — ver
 * `conDiasVacacionesPorAntiguedad`). El piso legal (`DIAS_VACACIONES_LCT`,
 * art. 150 LCT) no se valida acá: lo garantiza siempre
 * `calcularVacacionesNoGozadas` al momento de calcular, tramo por tramo, sin
 * importar qué valor se haya configurado. Esta validación solo evita valores
 * absurdos/inválidos a nivel de configuración (p.ej. un número de días
 * negativo, en cero, o no entero).
 */
export class DiasVacacionesInvalidosError extends Error {
  constructor(valor: number) {
    super(`Los días de vacaciones deben ser un número entero positivo (se recibió: ${valor})`);
    this.name = 'DiasVacacionesInvalidosError';
  }
}

export function validarDiasVacaciones(valor: number): void {
  if (!Number.isInteger(valor) || valor <= 0) {
    throw new DiasVacacionesInvalidosError(valor);
  }
}
