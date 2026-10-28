import { CruceDDJJ, DiferenciaDDJJ } from '@/lib/api-client';

const pesos = (valor: number) => valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const valor = (v: number | string | null) => (v === null ? '—' : typeof v === 'number' ? pesos(v) : v);

const GRUPO: Record<DiferenciaDDJJ['grupo'], { etiqueta: string; estilo: string }> = {
  presencia: { etiqueta: 'Presencia', estilo: 'bg-red-100 text-red-700' },
  modalidad: { etiqueta: 'Modalidad', estilo: 'bg-amber-100 text-amber-800' },
  base: { etiqueta: 'Base', estilo: 'bg-sky-100 text-sky-800' },
  importe: { etiqueta: 'Importe', estilo: 'bg-violet-100 text-violet-800' },
  declaracion: { etiqueta: 'Declaración', estilo: 'bg-rose-100 text-rose-800' },
};

function Indicador({ titulo, valor: v, alerta }: { titulo: string; valor: number; alerta?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${alerta && v > 0 ? 'text-red-700' : 'text-crowe-indigo'}`}>
        {v.toLocaleString('es-AR')}
      </p>
    </div>
  );
}

/** Diferencias por CUIL entre el reporte del sistema (y lo calculado por la app) y la DDJJ de Declaración en Línea. */
export function CruceDDJJPanel({ cruce, nombreArchivo, secuencia }: { cruce: CruceDDJJ; nombreArchivo: string; secuencia: string | null }) {
  const { resumen } = cruce;
  const totalesConDiferencia = cruce.totalesImportes.filter((t) => Math.abs(t.diferencia) >= 0.01);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        {nombreArchivo}
        {secuencia ? ` · Secuencia ${secuencia}` : ''} · Bases y modalidad se comparan contra el reporte del sistema; los
        importes, contra lo calculado por la app con las alícuotas del cliente.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="Sin diferencias" valor={resumen.sinDiferencias} />
        <Indicador titulo="Con diferencias" valor={resumen.conDiferencias} alerta />
        <Indicador titulo="Solo en el reporte" valor={resumen.soloEnReporte} alerta />
        <Indicador titulo="Solo en la DDJJ" valor={resumen.soloEnDDJJ} alerta />
      </div>

      {resumen.remuneracionTotalPorRedondeo > 0 && (
        <p className="text-xs text-slate-500">
          No se listan {resumen.remuneracionTotalPorRedondeo} diferencias de centavos en la Remuneración Total: están solo en
          los conceptos no remunerativos de la DDJJ (redondeo) y la parte remunerativa coincide.
        </p>
      )}

      {resumen.pasantesConSCVO > 0 && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {resumen.pasantesConSCVO === 1 ? 'Hay 1 pasante declarado' : `Hay ${resumen.pasantesConSCVO} pasantes declarados`} con
          cobertura de SCVO en la DDJJ. La pasantía (Ley 26.427) no lleva Seguro Colectivo de Vida Obligatorio.
        </p>
      )}

      {resumen.coberturaSCVOSinDato && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Esta nómina se importó antes del control de SCVO de pasantes: volvé a importarla para verlo.
        </p>
      )}

      {cruce.empleados.length === 0 ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          El reporte y la DDJJ coinciden en todos los CUIL.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Empleado</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Concepto</th>
                <th className="px-4 py-2 text-right font-medium">Sistema / App</th>
                <th className="px-4 py-2 text-right font-medium">DDJJ</th>
                <th className="px-4 py-2 text-right font-medium">Diferencia</th>
              </tr>
            </thead>
            {cruce.empleados.map((e) => (
              <tbody key={e.cuil} className="border-t border-slate-200">
                {e.diferencias.map((d, i) => (
                  <tr key={i} className="align-top">
                    {i === 0 && (
                      <td className="px-4 py-2" rowSpan={e.diferencias.length}>
                        <span className="font-medium">{e.nombre}</span>
                        <span className="block whitespace-nowrap text-xs text-slate-500">
                          CUIL {e.cuil}
                          {e.legajo ? ` · leg. ${e.legajo}` : ''}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${GRUPO[d.grupo].estilo}`}>
                        {GRUPO[d.grupo].etiqueta}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {d.concepto}
                      {d.detalle && <span className="block text-xs text-slate-500">{d.detalle}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{valor(d.valorSistema)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{valor(d.valorDDJJ)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums">
                      {d.diferencia === null ? '—' : pesos(d.diferencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {totalesConDiferencia.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Totales por concepto (CUIL en ambos archivos)</th>
                <th className="px-4 py-2 text-right font-medium">App</th>
                <th className="px-4 py-2 text-right font-medium">DDJJ</th>
                <th className="px-4 py-2 text-right font-medium">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {totalesConDiferencia.map((t) => (
                <tr key={t.codigo}>
                  <td className="px-4 py-2">{t.concepto}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{pesos(t.app)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{pesos(t.ddjj)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums">{pesos(t.diferencia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
