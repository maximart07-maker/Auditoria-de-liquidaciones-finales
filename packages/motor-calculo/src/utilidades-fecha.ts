const MS_POR_DIA = 1000 * 60 * 60 * 24;

/** Todas las fechas se tratan en UTC para evitar corrimientos por husos horarios. */
function utc(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes, dia));
}

export function diasEntre(desde: Date, hasta: Date): number {
  const a = utc(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const b = utc(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());
  return Math.round((b.getTime() - a.getTime()) / MS_POR_DIA);
}

export function maxFecha(a: Date, b: Date): Date {
  return a.getTime() > b.getTime() ? a : b;
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
 * supera los 3 meses (fracción mayor a 3 meses se computa como año entero). */
export function aniosConFraccion(fechaIngreso: Date, fechaEgreso: Date): number {
  const mesesTotales = diferenciaEnMeses(fechaIngreso, fechaEgreso);
  const aniosCompletos = Math.floor(mesesTotales / 12);
  const mesesFraccion = mesesTotales % 12;
  return aniosCompletos + (mesesFraccion > 3 ? 1 : 0);
}

/** Meses trabajados en un período, para el proporcional de vacaciones: los meses
 * completos más uno si los días restantes llegan a 15 o más. */
export function mesesTrabajadosEnPeriodo(desde: Date, hasta: Date): number {
  const meses = diferenciaEnMeses(desde, hasta);
  const fechaTrasMeses = sumarMeses(desde, meses);
  const diasRestantes = diasEntre(fechaTrasMeses, hasta);
  return meses + (diasRestantes >= 15 ? 1 : 0);
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
