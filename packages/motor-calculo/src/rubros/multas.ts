import { RubroCalculado, VariablesCaso } from '../tipos';

/** Multa art. 2 Ley 25.323 — falta de pago en término, con intimación previa incumplida. */
export function calcularMultaArt2Ley25323(
  v: VariablesCaso,
  indemnizacionAntiguedad: RubroCalculado,
  preaviso: RubroCalculado,
  integracionMes: RubroCalculado,
): RubroCalculado {
  if (v.tipoExtincion !== 'despido_sin_causa' || !v.intimacionPagoCursada) {
    return { rubro: 'MULTA_ART2_25323', monto: 0, detalle: { motivo: 'no aplica o sin intimación' } };
  }

  const baseIndemnizatoria = indemnizacionAntiguedad.monto + preaviso.monto + integracionMes.monto;
  const monto = baseIndemnizatoria * 0.5;

  return { rubro: 'MULTA_ART2_25323', monto, detalle: { baseIndemnizatoria } };
}

/** Multa art. 1 Ley 25.323 — registración deficiente o ausente: duplica la indemnización
 * por antigüedad. Solo tiene sentido cuando esa indemnización efectivamente se debe
 * (despido sin causa); para otros tipos de extinción el llamador debe pasar un rubro con monto 0. */
export function calcularMultaArt1Ley25323(indemnizacionAntiguedad: RubroCalculado): RubroCalculado {
  const monto = indemnizacionAntiguedad.monto;
  return { rubro: 'MULTA_ART1_25323', monto, detalle: { baseIndemnizacionAntiguedad: indemnizacionAntiguedad.monto } };
}

/** Multa art. 80 LCT — falta de entrega de certificados de trabajo, tras intimación y
 * vencido el plazo legal (30 días corridos desde la extinción). */
export function calcularMultaArt80(v: VariablesCaso): RubroCalculado {
  if (v.certificadosEntregados || !v.intimacionCertificadosCursada) {
    return { rubro: 'MULTA_ART80', monto: 0, detalle: { motivo: 'certificados entregados o sin intimación' } };
  }

  const monto = v.mejorRemuneracionMensualNormalYHabitual * 3;
  return { rubro: 'MULTA_ART80', monto, detalle: { mrmnh: v.mejorRemuneracionMensualNormalYHabitual } };
}
