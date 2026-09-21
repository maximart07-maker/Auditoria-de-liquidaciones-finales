import { repositorioParametrosPorDefecto, RepositorioParametrosNormativos } from './parametros';
import { calcularIndemnizacionAntiguedad } from './rubros/indemnizacion-antiguedad';
import { calcularIntegracionMes } from './rubros/integracion-mes';
import { calcularMultaArt1Ley25323, calcularMultaArt2Ley25323, calcularMultaArt80 } from './rubros/multas';
import { calcularPreaviso } from './rubros/preaviso';
import { calcularSACProporcional } from './rubros/sac-proporcional';
import { calcularSACSobreVacaciones } from './rubros/sac-sobre-vacaciones';
import { calcularVacacionesNoGozadas } from './rubros/vacaciones-no-gozadas';
import { LiquidacionCalculada, RubroCalculado, VariablesCaso } from './tipos';

/**
 * Orquesta el cálculo de todos los rubros aplicables a un caso y arma la
 * `Liquidacion` de origen "sistema". A diferencia de un registro genérico
 * código→función (ver docs/motor-calculo.md §5), aquí se respetan las
 * dependencias reales entre rubros: SAC sobre vacaciones depende del monto de
 * vacaciones no gozadas, y las multas dependen de la indemnización/preaviso/
 * integración ya calculados.
 */
export function calcularLiquidacionSistema(
  variables: VariablesCaso,
  repositorioParametros: RepositorioParametrosNormativos = repositorioParametrosPorDefecto,
): LiquidacionCalculada {
  const parametros = repositorioParametros.obtenerVigentes(variables.convenioColectivo, variables.fechaEgreso);
  const esDespidoSinCausa = variables.tipoExtincion === 'despido_sin_causa';
  const rubros: RubroCalculado[] = [];

  // La indemnización por antigüedad solo se debe legalmente en un despido sin causa;
  // igual se calcula siempre porque preaviso/integración/multas la usan como base,
  // pero se ignora (monto 0) para los demás tipos de extinción.
  const indemnizacionAntiguedad = calcularIndemnizacionAntiguedad(variables, parametros);
  const preaviso = calcularPreaviso(variables);
  const integracionMes = calcularIntegracionMes(variables);

  if (esDespidoSinCausa) {
    if (indemnizacionAntiguedad.monto > 0) rubros.push(indemnizacionAntiguedad);
    if (preaviso.monto > 0) rubros.push(preaviso);
    if (integracionMes.monto > 0) rubros.push(integracionMes);

    const multa2 = calcularMultaArt2Ley25323(variables, indemnizacionAntiguedad, preaviso, integracionMes);
    if (multa2.monto > 0) rubros.push(multa2);
  }

  const sacProporcional = calcularSACProporcional(variables);
  rubros.push(sacProporcional);

  const vacacionesNoGozadas = calcularVacacionesNoGozadas(variables, parametros);
  if (vacacionesNoGozadas.monto > 0) rubros.push(vacacionesNoGozadas);

  const sacSobreVacaciones = calcularSACSobreVacaciones(vacacionesNoGozadas);
  if (sacSobreVacaciones.monto > 0) rubros.push(sacSobreVacaciones);

  if (variables.registracionDeficiente) {
    const baseParaMulta1 = esDespidoSinCausa ? indemnizacionAntiguedad : { ...indemnizacionAntiguedad, monto: 0 };
    const multa1 = calcularMultaArt1Ley25323(baseParaMulta1);
    if (multa1.monto > 0) rubros.push(multa1);
  }

  const multa80 = calcularMultaArt80(variables);
  if (multa80.monto > 0) rubros.push(multa80);

  const total = rubros.reduce((acumulado, rubro) => acumulado + rubro.monto, 0);

  return { origen: 'sistema', fechaCalculo: new Date(), rubros, total };
}
