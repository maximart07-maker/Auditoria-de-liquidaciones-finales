/**
 * Catálogo de códigos de Modalidad de Contratación de ARCA (Mi Simplificación /
 * F.931), tal como lo usa el estudio. Los códigos se comparan sin ceros a la
 * izquierda ("027" = "27").
 */

const CATALOGO: Record<string, string> = {
  '1': 'A tiempo parcial - Indeterminado / Permanente',
  '2': 'Becarios - Residencias médicas (Ley 22.127)',
  '3': 'De aprendizaje (Ley 25.013)',
  '8': 'A tiempo completo - Indeterminado / Permanente',
  '10': 'Práctica profesionalizante (Decreto 1374/11) - Pasantía sin obra social',
  '11': 'Trabajo de temporada',
  '12': 'Trabajo eventual',
  '18': 'Trabajador discapacitado (art. 34, Ley 24.147)',
  '21': 'A tiempo parcial - Determinado (plazo fijo)',
  '22': 'A tiempo completo - Determinado (plazo fijo)',
  '23': 'Personal no permanente (Ley 22.248 - Trabajo Agrario)',
  '24': 'Personal de la construcción (Ley 22.250)',
  '26': 'Beneficiario de programa de empleo, capacitación y recuperación productiva',
  '27': 'Pasantías educativas (Ley 26.427) - Con obra social',
  '49': 'Director - Empleado de S.A. con obra social y ART',
  '51': 'Pasantías Ley 26.427 - Con obra social - Beneficiario pensión de discapacidad',
  '60': 'Taller Protegido Especial para el Empleo (Ley 26.816)',
  '61': 'Actor / Intérprete (Ley 27.203) - Con obra social',
  '62': 'Actor / Intérprete (Ley 27.203) - Sin obra social',
  '99': 'Socios, directores o administradores de sociedades - Solo riesgos del trabajo (LRT)',
  '102': 'Personal de Casas Particulares (Ley 26.844)',
  '103': 'Personal de Casas Particulares (Ley 26.844)',
};

/** "008" → "8"; un código no numérico se devuelve sin espacios. */
export function normalizarCodigoModalidad(codigo: string): string {
  const limpio = codigo.trim();
  return /^\d+$/.test(limpio) ? String(Number(limpio)) : limpio;
}

/** Descripción del código, o null si no está en el catálogo. */
export function descripcionModalidadContratacion(codigo: string): string | null {
  const c = normalizarCodigoModalidad(codigo);
  if (CATALOGO[c]) return CATALOGO[c];
  const n = Number(c);
  if (Number.isInteger(n) && n >= 601 && n <= 614) return 'Programa de incentivo o formalización laboral';
  return null;
}
