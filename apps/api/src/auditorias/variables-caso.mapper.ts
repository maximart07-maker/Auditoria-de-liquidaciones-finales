import { BadRequestException } from '@nestjs/common';
import { VariablesCaso } from '@audit/motor-calculo';
import { Caso, Empleado, VariableCaso } from '@prisma/client';

/** Claves de `VariableCaso` que el motor de cálculo necesita además de lo que ya
 * vive en `Empleado` (fechaIngreso, convenioColectivo) y `Caso` (fechaExtincion,
 * tipoExtincion) — ver docs/motor-calculo.md §2. */
const CLAVES_REQUERIDAS = [
  'mejorRemuneracionMensualNormalYHabitual',
  'sueldoMensualActual',
  'diasVacacionesGozadosEnElAnio',
  'preavisoOtorgado',
  'intimacionPagoCursada',
  'intimacionCertificadosCursada',
  'certificadosEntregados',
  'registracionDeficiente',
] as const;

function aBooleano(valor: string): boolean {
  return valor === 'true';
}

function aNumero(clave: string, valor: string): number {
  const numero = Number(valor);
  if (Number.isNaN(numero)) throw new BadRequestException(`La variable "${clave}" no es un número válido: "${valor}"`);
  return numero;
}

/** Traduce las `VariableCaso` sueltas (clave/valor) cargadas por el auditor en las
 * `VariablesCaso` tipadas que espera @audit/motor-calculo. Lanza si falta alguna
 * variable obligatoria para el tipo de extinción del caso. */
export function variablesCasoDesde(
  caso: Caso,
  empleado: Empleado,
  variables: VariableCaso[],
): VariablesCaso {
  const mapa = new Map(variables.map((v) => [v.clave, v.valor]));

  const faltantes = CLAVES_REQUERIDAS.filter((clave) => !mapa.has(clave));
  if (faltantes.length > 0) {
    throw new BadRequestException(`Faltan variables obligatorias para auditar el caso: ${faltantes.join(', ')}`);
  }

  return {
    fechaIngreso: empleado.fechaIngreso,
    fechaEgreso: caso.fechaExtincion,
    tipoExtincion: caso.tipoExtincion,
    mejorRemuneracionMensualNormalYHabitual: aNumero(
      'mejorRemuneracionMensualNormalYHabitual',
      mapa.get('mejorRemuneracionMensualNormalYHabitual')!,
    ),
    sueldoMensualActual: aNumero('sueldoMensualActual', mapa.get('sueldoMensualActual')!),
    diasVacacionesGozadosEnElAnio: aNumero(
      'diasVacacionesGozadosEnElAnio',
      mapa.get('diasVacacionesGozadosEnElAnio')!,
    ),
    preavisoOtorgado: aBooleano(mapa.get('preavisoOtorgado')!),
    intimacionPagoCursada: aBooleano(mapa.get('intimacionPagoCursada')!),
    intimacionCertificadosCursada: aBooleano(mapa.get('intimacionCertificadosCursada')!),
    certificadosEntregados: aBooleano(mapa.get('certificadosEntregados')!),
    registracionDeficiente: aBooleano(mapa.get('registracionDeficiente')!),
    convenioColectivo: empleado.convenioColectivo ?? 'GENERICO',
  };
}
