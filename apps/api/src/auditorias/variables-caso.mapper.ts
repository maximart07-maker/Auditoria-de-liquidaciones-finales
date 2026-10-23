import { BadRequestException } from '@nestjs/common';
import { VariablesCaso } from '@audit/motor-calculo';
import { Caso, Empleado, VariableCaso } from '@prisma/client';

/** Claves de `VariableCaso` que el motor de cálculo necesita además de lo que ya
 * vive en `Empleado` (fechaIngreso, convenioColectivo) y `Caso` (fechaExtincion,
 * tipoExtincion) — ver docs/motor-calculo.md §2. La MRMNH no se carga acá: se
 * deriva del histórico de `RemuneracionMensual` vía `calcularMRMNH` (ver
 * AuditoriasService.repositorioParametrosParaCliente y §2.1). `sueldoMensualActual`
 * tampoco es obligatoria acá: se deriva por defecto de la `RemuneracionMensual`
 * del mes de egreso (ver AuditoriasService.sueldoBaseIndemnizacionDelCaso) y
 * solo hace falta cargarla a mano si no hay ninguna remuneración importada para
 * ese mes. */
const CLAVES_REQUERIDAS = ['diasVacacionesGozadosEnElAnio', 'preavisoOtorgado'] as const;

function aBooleano(valor: string): boolean {
  return valor === 'true';
}

function aNumero(clave: string, valor: string): number {
  const numero = Number(valor);
  if (Number.isNaN(numero)) throw new BadRequestException(`La variable "${clave}" no es un número válido: "${valor}"`);
  return numero;
}

/** Convierte una variable opcional a número; si no fue cargada, asume 0 (sin
 * deuda conocida) en vez de bloquear la auditoría — a diferencia de las claves
 * en `CLAVES_REQUERIDAS`. */
function aNumeroOpcional(clave: string, valor: string | undefined): number {
  if (valor === undefined) return 0;
  return aNumero(clave, valor);
}

/** Traduce las `VariableCaso` sueltas (clave/valor) cargadas por el auditor, más
 * la MRMNH ya derivada del histórico de remuneraciones mensuales, en las
 * `VariablesCaso` tipadas que espera @audit/motor-calculo. Lanza si falta alguna
 * variable obligatoria para el tipo de extinción del caso.
 *
 * @param sueldoBaseIndemnizacion Base de `sueldoMensualActual` (vacaciones no
 * gozadas, arts. 150/156 LCT) derivada de la `RemuneracionMensual` del mes de
 * egreso ya filtrada por el catálogo de conceptos del cliente (solo los
 * marcados `baseIndemnizacion=true`) — ver AuditoriasService y
 * docs/motor-calculo.md §2.4. Una variable manual `sueldoMensualActual`
 * cargada por el auditor tiene prioridad sobre este valor por defecto.
 * @param baseSAC Base de `mejorRemuneracionSemestral` (SAC proporcional, arts.
 * 121 a 123 LCT según Ley 23.041) derivada de la mejor `RemuneracionMensual`
 * dentro del semestre calendario del egreso — ver AuditoriasService y
 * `calcularBaseSAC`. Una variable manual `mejorRemuneracionSemestral` cargada
 * por el auditor tiene prioridad sobre este valor por defecto.
 */
export function variablesCasoDesde(
  caso: Caso,
  empleado: Empleado,
  variables: VariableCaso[],
  mrmnh: number,
  sueldoBaseIndemnizacion: number | null,
  baseSAC: number | null,
): VariablesCaso {
  const mapa = new Map(variables.map((v) => [v.clave, v.valor]));

  const faltantes = CLAVES_REQUERIDAS.filter((clave) => !mapa.has(clave));
  if (faltantes.length > 0) {
    throw new BadRequestException(`Faltan variables obligatorias para auditar el caso: ${faltantes.join(', ')}`);
  }

  const sueldoMensualActual = mapa.has('sueldoMensualActual')
    ? aNumero('sueldoMensualActual', mapa.get('sueldoMensualActual')!)
    : sueldoBaseIndemnizacion;
  if (sueldoMensualActual === null) {
    throw new BadRequestException(
      'Falta "sueldoMensualActual": no hay una remuneración mensual importada para el mes de egreso ' +
        'de la que derivarlo, así que hay que cargarlo a mano en Variables.',
    );
  }

  const mejorRemuneracionSemestral = mapa.has('mejorRemuneracionSemestral')
    ? aNumero('mejorRemuneracionSemestral', mapa.get('mejorRemuneracionSemestral')!)
    : baseSAC;
  if (mejorRemuneracionSemestral === null) {
    throw new BadRequestException(
      'Falta "mejorRemuneracionSemestral": no hay una remuneración mensual normal y habitual importada dentro ' +
        'del semestre del egreso de la que derivarla, así que hay que cargarla a mano en Variables.',
    );
  }

  return {
    fechaIngreso: empleado.fechaIngreso,
    fechaEgreso: caso.fechaExtincion,
    tipoExtincion: caso.tipoExtincion,
    mejorRemuneracionMensualNormalYHabitual: mrmnh,
    mejorRemuneracionSemestral,
    sueldoMensualActual,
    diasVacacionesGozadosEnElAnio: aNumero(
      'diasVacacionesGozadosEnElAnio',
      mapa.get('diasVacacionesGozadosEnElAnio')!,
    ),
    diasVacacionesCorrespondientesManual: aNumeroOpcional(
      'diasVacacionesCorrespondientesManual',
      mapa.get('diasVacacionesCorrespondientesManual'),
    ),
    diasVacacionesPendientesPeriodosAnteriores: aNumeroOpcional(
      'diasVacacionesPendientesPeriodosAnteriores',
      mapa.get('diasVacacionesPendientesPeriodosAnteriores'),
    ),
    preavisoOtorgado: aBooleano(mapa.get('preavisoOtorgado')!),
    convenioColectivo: empleado.convenioColectivo ?? 'GENERICO',
  };
}
