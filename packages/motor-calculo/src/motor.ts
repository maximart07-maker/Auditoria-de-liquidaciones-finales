import { repositorioParametrosPorDefecto, RepositorioParametrosNormativos } from './parametros';
import { calcularIndemnizacionAntiguedad } from './rubros/indemnizacion-antiguedad';
import { calcularIntegracionMes } from './rubros/integracion-mes';
import { calcularPreaviso } from './rubros/preaviso';
import { calcularSACProporcional } from './rubros/sac-proporcional';
import { calcularSACSobreVacaciones } from './rubros/sac-sobre-vacaciones';
import { calcularVacacionesNoGozadas } from './rubros/vacaciones-no-gozadas';
import { calcularVacacionesPeriodosAnteriores } from './rubros/vacaciones-periodos-anteriores';
import { LiquidacionCalculada, RubroCalculado, VariablesCaso } from './tipos';

/**
 * Orquesta el cálculo de todos los rubros aplicables a un caso y arma la
 * `Liquidacion` de origen "sistema". A diferencia de un registro genérico
 * código→función (ver docs/motor-calculo.md §5), aquí se respeta la
 * dependencia real entre rubros: SAC sobre vacaciones depende del monto de
 * vacaciones no gozadas ya calculado.
 */
export function calcularLiquidacionSistema(
  variables: VariablesCaso,
  repositorioParametros: RepositorioParametrosNormativos = repositorioParametrosPorDefecto,
): LiquidacionCalculada {
  const parametros = repositorioParametros.obtenerVigentes(variables.convenioColectivo, variables.fechaEgreso);
  const esDespidoSinCausa = variables.tipoExtincion === 'despido_sin_causa';
  const rubros: RubroCalculado[] = [];

  // La indemnización por antigüedad solo se debe legalmente en un despido sin causa;
  // se ignora (monto 0) para los demás tipos de extinción.
  const indemnizacionAntiguedad = calcularIndemnizacionAntiguedad(variables, parametros);
  const preaviso = calcularPreaviso(variables);
  const integracionMes = calcularIntegracionMes(variables);

  if (esDespidoSinCausa) {
    if (indemnizacionAntiguedad.monto > 0) rubros.push(indemnizacionAntiguedad);
    if (preaviso.monto > 0) rubros.push(preaviso);
    if (integracionMes.monto > 0) rubros.push(integracionMes);
  }

  const sacProporcional = calcularSACProporcional(variables);
  rubros.push(sacProporcional);

  const vacacionesNoGozadas = calcularVacacionesNoGozadas(variables, parametros);
  if (vacacionesNoGozadas.monto > 0) rubros.push(vacacionesNoGozadas);

  const sacSobreVacaciones = calcularSACSobreVacaciones(vacacionesNoGozadas);
  if (sacSobreVacaciones.monto > 0) rubros.push(sacSobreVacaciones);

  // Control aparte del proporcional del año en curso: días de vacaciones adeudados
  // de años anteriores, nunca otorgados ni compensados. No devenga SAC adicional
  // (a diferencia de vacacionesNoGozadas del año en curso).
  const vacacionesPeriodosAnteriores = calcularVacacionesPeriodosAnteriores(variables, parametros);
  if (vacacionesPeriodosAnteriores.monto > 0) rubros.push(vacacionesPeriodosAnteriores);

  const total = rubros.reduce((acumulado, rubro) => acumulado + rubro.monto, 0);

  return { origen: 'sistema', fechaCalculo: new Date(), rubros, total };
}
