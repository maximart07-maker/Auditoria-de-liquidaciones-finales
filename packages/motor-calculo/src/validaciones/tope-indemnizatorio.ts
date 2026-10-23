/**
 * Reglas de validación para los parámetros normativos configurables (p.ej. por
 * cliente/convenio) que alimentan el cálculo de la indemnización por antigüedad
 * (art. 245 LCT). Un cliente puede tener un tope indemnizatorio propio (varía
 * según el convenio colectivo aplicable), pero nunca puede eludir el piso fijado
 * por la doctrina de la CSJN en "Vizzoti" — eso lo garantiza
 * `calcularIndemnizacionAntiguedad`, que siempre aplica `Math.max(base, 0.67 * mrmnh)`
 * sin importar qué tope se le pase. Esta validación solo evita valores
 * absurdos/inválidos a nivel de configuración (p.ej. un tope negativo o en cero).
 */
export class TopeIndemnizatorioInvalidoError extends Error {
  constructor(valor: number) {
    super(`El tope indemnizatorio debe ser un número positivo (se recibió: ${valor})`);
    this.name = 'TopeIndemnizatorioInvalidoError';
  }
}

export function validarTopeIndemnizatorio(valor: number): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new TopeIndemnizatorioInvalidoError(valor);
  }
}
