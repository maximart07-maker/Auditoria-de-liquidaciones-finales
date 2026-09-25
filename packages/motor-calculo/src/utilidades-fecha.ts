/** Todas las fechas se tratan en UTC para evitar corrimientos por husos horarios. */
function utc(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes, dia));
}

export function maxFecha(a: Date, b: Date): Date {
  return a.getTime() > b.getTime() ? a : b;
}

/** Cuenta días bajo la convención comercial (mes de 30 días, año de 360), variante
 * 30E/360: cada mes calendario cuenta como 30 días sin importar su duración real
 * (28 a 31), así que cualquier semestre equivale siempre a 180 días. Usada para el
 * SAC proporcional (Ley 23.041) y las vacaciones no gozadas (art. 150 LCT), en
 * vez de contar días calendario reales. */
export function diasEntreComercial(desde: Date, hasta: Date): number {
  const anios = hasta.getUTCFullYear() - desde.getUTCFullYear();
  const meses = hasta.getUTCMonth() - desde.getUTCMonth();
  const diaDesde = Math.min(desde.getUTCDate(), 30);
  const diaHasta = Math.min(hasta.getUTCDate(), 30);
  return anios * 360 + meses * 30 + (diaHasta - diaDesde);
}

export function diasEnElMes(fecha: Date): number {
  return utc(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0).getUTCDate();
}

export function diaDelMes(fecha: Date): number {
  return fecha.getUTCDate();
}

export function inicioDelAnio(fecha: Date): Date {
  return utc(fecha.getUTCFullYear(), 0, 1);
}

export function finDelAnio(fecha: Date): Date {
  return utc(fecha.getUTCFullYear(), 11, 31);
}

export function sumarMeses(fecha: Date, cantidad: number): Date {
  return utc(fecha.getUTCFullYear(), fecha.getUTCMonth() + cantidad, fecha.getUTCDate());
}

/** Diferencia en meses completos entre dos fechas (no cuenta el mes en curso si el día
 * de `hasta` es anterior al día de `desde`). */
export function diferenciaEnMeses(desde: Date, hasta: Date): number {
  let meses = (hasta.getUTCFullYear() - desde.getUTCFullYear()) * 12 + (hasta.getUTCMonth() - desde.getUTCMonth());
  if (hasta.getUTCDate() < desde.getUTCDate()) meses -= 1;
  return Math.max(meses, 0);
}

/** Antigüedad en años para el art. 245 LCT: los años completos entre `fechaIngreso` y
 * `fechaEgreso`, más un año adicional si la fracción posterior al último aniversario
 * supera los 3 meses (fracción mayor a 3 meses se computa como año entero). Esta regla
 * de redondeo es específica del art. 245 (indemnización por antigüedad) — para la
 * tabla de días de vacaciones por antigüedad (art. 150 LCT) usar `aniosCompletos`. */
export function aniosConFraccion(fechaIngreso: Date, fechaEgreso: Date): number {
  const mesesTotales = diferenciaEnMeses(fechaIngreso, fechaEgreso);
  const aniosCompletos = Math.floor(mesesTotales / 12);
  const mesesFraccion = mesesTotales % 12;
  return aniosCompletos + (mesesFraccion > 3 ? 1 : 0);
}

/** Años completos entre dos fechas, sin ninguna regla de redondeo por fracción
 * (a diferencia de `aniosConFraccion`, específica del art. 245). Para el tramo
 * de la tabla de días de vacaciones por antigüedad (art. 150 LCT) se usa junto
 * con `finDelAnio`, no con `fechaEgreso` directamente — ver `calcularVacacionesNoGozadas`. */
export function aniosCompletos(fechaIngreso: Date, fechaEgreso: Date): number {
  return Math.floor(diferenciaEnMeses(fechaIngreso, fechaEgreso) / 12);
}

export interface RangoSemestre {
  inicio: Date;
  fin: Date;
}

/** Semestre calendario (1/1–30/6 o 1/7–31/12) al que pertenece `fecha`, para el SAC. */
export function semestreDe(fecha: Date): RangoSemestre {
  const anio = fecha.getUTCFullYear();
  if (fecha.getUTCMonth() < 6) {
    return { inicio: utc(anio, 0, 1), fin: utc(anio, 5, 30) };
  }
  return { inicio: utc(anio, 6, 1), fin: utc(anio, 11, 31) };
}
