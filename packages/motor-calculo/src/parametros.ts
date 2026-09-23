import { DiasVacacionesPorAntiguedad, ParametrosNormativos } from './tipos';

/**
 * Piso legal de días de vacaciones por antigüedad — art. 150 LCT. Ningún
 * convenio colectivo ni configuración de cliente puede otorgar menos que esto
 * (puede mejorarlo, nunca empeorarlo — orden público laboral); `calcularVacacionesNoGozadas`
 * lo aplica siempre como mínimo, sin importar qué tabla venga en `ParametrosNormativos`
 * (mismo criterio que el piso del 67% de la MRMNH, doctrina "Vizzoti", para IND_ANTIGUEDAD).
 */
export const DIAS_VACACIONES_LCT: DiasVacacionesPorAntiguedad = {
  hasta5Anios: 14,
  de5a10Anios: 21,
  de10a20Anios: 28,
  masDe20Anios: 35,
};

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
    diasVacacionesPorAntiguedad: DIAS_VACACIONES_LCT,
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

/**
 * Envuelve un repositorio base devolviendo los mismos `ParametrosNormativos`
 * pero con el `topeIndemnizatorio` reemplazado por el configurado a nivel
 * cliente (p.ej. porque negocia un convenio con un tope distinto al genérico).
 * No relaja ninguna validación legal: `calcularIndemnizacionAntiguedad` sigue
 * aplicando el piso del 67% de la MRMNH (doctrina "Vizzoti") sobre el resultado,
 * cualquiera sea el tope recibido acá.
 */
export function conTopeIndemnizatorio(
  base: RepositorioParametrosNormativos,
  topeIndemnizatorio: number,
): RepositorioParametrosNormativos {
  return {
    obtenerVigentes(convenio: string, fecha: Date): ParametrosNormativos {
      return { ...base.obtenerVigentes(convenio, fecha), topeIndemnizatorio };
    },
  };
}

/**
 * Envuelve un repositorio base reemplazando, tramo por tramo de antigüedad, la
 * tabla de días de vacaciones anuales por la que el cliente configuró (p.ej.
 * porque el convenio colectivo aplicable a sus empleados otorga más días que
 * el genérico) — solo los tramos presentes en `override` se reemplazan, el
 * resto sigue viniendo del repositorio base. Igual que con el tope
 * indemnizatorio, no relaja ninguna validación legal: `calcularVacacionesNoGozadas`
 * sigue aplicando siempre `DIAS_VACACIONES_LCT` como piso, tramo por tramo, sin
 * importar qué tabla reciba acá.
 */
export function conDiasVacacionesPorAntiguedad(
  base: RepositorioParametrosNormativos,
  override: Partial<DiasVacacionesPorAntiguedad>,
): RepositorioParametrosNormativos {
  return {
    obtenerVigentes(convenio: string, fecha: Date): ParametrosNormativos {
      const parametros = base.obtenerVigentes(convenio, fecha);
      return {
        ...parametros,
        diasVacacionesPorAntiguedad: { ...parametros.diasVacacionesPorAntiguedad, ...override },
      };
    },
  };
}
