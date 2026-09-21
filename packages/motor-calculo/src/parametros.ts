import { ParametrosNormativos } from './tipos';

/**
 * Repositorio en memoria de parámetros normativos, a modo de ejemplo/semilla.
 * En la aplicación real estos registros viven en la tabla `parametro_normativo`
 * (ver docs/modelo-datos.md — "Próximos pasos de modelado") y se cargan/editan
 * por un admin legal sin tocar código, versionados por rango de vigencia.
 */
const PARAMETROS_SEED: ParametrosNormativos[] = [
  {
    convenioColectivo: 'GENERICO',
    vigenciaDesde: new Date(Date.UTC(2000, 0, 1)),
    vigenciaHasta: null,
    topeIndemnizatorio: 1_500_000,
    divisorSAC: 12,
    divisorVacaciones: 25,
    diasVacacionesPorAntiguedad: {
      hasta5Anios: 14,
      de5a10Anios: 21,
      de10a20Anios: 28,
      masDe20Anios: 35,
    },
  },
];

export class ParametroNormativoNoEncontradoError extends Error {
  constructor(convenio: string, fecha: Date) {
    super(`No hay parámetros normativos cargados para el convenio "${convenio}" vigentes al ${fecha.toISOString().slice(0, 10)}`);
    this.name = 'ParametroNormativoNoEncontradoError';
  }
}

export interface RepositorioParametrosNormativos {
  obtenerVigentes(convenio: string, fecha: Date): ParametrosNormativos;
}

export function crearRepositorioEnMemoria(
  registros: ParametrosNormativos[] = PARAMETROS_SEED,
): RepositorioParametrosNormativos {
  return {
    obtenerVigentes(convenio: string, fecha: Date): ParametrosNormativos {
      const encontrado = registros.find(
        (p) =>
          p.convenioColectivo === convenio &&
          p.vigenciaDesde <= fecha &&
          (p.vigenciaHasta === null || p.vigenciaHasta >= fecha),
      );
      if (!encontrado) throw new ParametroNormativoNoEncontradoError(convenio, fecha);
      return encontrado;
    },
  };
}

/** Repositorio por defecto (seed), útil para pruebas y para bootstrap local. */
export const repositorioParametrosPorDefecto = crearRepositorioEnMemoria();
