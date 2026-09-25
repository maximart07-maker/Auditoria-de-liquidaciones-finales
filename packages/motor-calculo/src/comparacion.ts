import { CodigoRubro, Hallazgo, LiquidacionCalculada, RubroDeclarado, Severidad } from './tipos';

/** Diferencia absoluta ($) a partir de la cual un hallazgo se considera de severidad
 * "alta" aunque el porcentaje de diferencia sea bajo (montos grandes con % chico
 * igual representan un riesgo económico relevante para el cliente). */
const UMBRAL_MONTO_ALTA = 100_000;

export function clasificarSeveridad(diferencia: number, porcentajeDiferencia: number): Severidad {
  const porcentajeAbsoluto = Math.abs(porcentajeDiferencia);
  if (porcentajeAbsoluto > 10 || Math.abs(diferencia) > UMBRAL_MONTO_ALTA) return 'alta';
  if (porcentajeAbsoluto > 3) return 'media';
  return 'baja';
}

/** Compara la liquidación declarada por la empresa contra la calculada por el sistema
 * y produce un `Hallazgo` por cada rubro presente en cualquiera de las dos. */
export function generarHallazgos(
  liquidacionEmpresa: RubroDeclarado[],
  liquidacionSistema: LiquidacionCalculada,
): Hallazgo[] {
  const rubrosDeclarados = new Map(liquidacionEmpresa.map((r) => [r.rubro, r.monto]));
  const rubrosCalculados = new Map(liquidacionSistema.rubros.map((r) => [r.rubro, r.monto]));

  const codigosRubro = new Set<CodigoRubro>([...rubrosDeclarados.keys(), ...rubrosCalculados.keys()]);

  return Array.from(codigosRubro).map((rubro): Hallazgo => {
    const montoDeclarado = rubrosDeclarados.get(rubro) ?? 0;
    const montoCalculado = rubrosCalculados.get(rubro) ?? 0;
    const diferencia = montoCalculado - montoDeclarado;
    const porcentajeDiferencia = montoDeclarado !== 0 ? (diferencia / montoDeclarado) * 100 : montoCalculado > 0 ? 100 : 0;

    return {
      rubro,
      montoDeclarado,
      montoCalculado,
      diferencia,
      porcentajeDiferencia,
      severidad: clasificarSeveridad(diferencia, porcentajeDiferencia),
      estado: 'pendiente',
    };
  });
}
