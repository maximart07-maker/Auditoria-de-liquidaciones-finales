import Link from 'next/link';
import { ConceptoF931, ControlF931 } from '@/lib/api-client';
import { SeveridadBadge } from '@/components/ui/severidad-badge';

const pesos = (valor: number | null) =>
  valor === null ? '—' : valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porcentaje = (valor: number | null) =>
  valor === null ? '—' : `${valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`;

function Tarjeta({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-crowe-indigo">{valor}</p>
      {nota && <p className="text-xs text-slate-400">{nota}</p>}
    </div>
  );
}

function TablaConceptos({ conceptos, total }: { conceptos: ConceptoF931[]; total: number | null }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Concepto</th>
            <th className="px-4 py-2 font-medium">Base</th>
            <th className="px-4 py-2 text-right font-medium">Base imponible</th>
            <th className="px-4 py-2 text-right font-medium">Alícuota</th>
            <th className="px-4 py-2 text-right font-medium">Fijo x empleado</th>
            <th className="px-4 py-2 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {conceptos.map((c) => (
            <tr key={c.codigo}>
              <td className="px-4 py-2">{c.descripcion}</td>
              <td className="whitespace-nowrap px-4 py-2 text-slate-500">{c.baseEtiqueta ?? '—'}</td>
              <td className="px-4 py-2 text-right tabular-nums">{pesos(c.baseTotal)}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {c.pendiente ? (
                  <span
                    title={c.pendiente}
                    className="whitespace-nowrap rounded-full bg-crowe-ambar/15 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-800"
                  >
                    A confirmar
                  </span>
                ) : (
                  porcentaje(c.alicuota)
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{c.fijoPorEmpleado ? pesos(c.fijoPorEmpleado) : '—'}</td>
              <td className="px-4 py-2 text-right font-medium tabular-nums">{pesos(c.importe)}</td>
            </tr>
          ))}
        </tbody>
        {total !== null && (
          <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
            <tr>
              <td className="px-4 py-2" colSpan={5}>
                Total
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{pesos(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function Seccion({ titulo, children, accion }: { titulo: string; children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** Encabezado corto de cada concepto en el detalle por empleado. */
const COLUMNA_CONCEPTO: Record<string, string> = {
  CONTRIB_SUSS: 'SUSS',
  CONTRIB_OBRA_SOCIAL: 'Obra social',
  CONTRIB_FSR: 'FSR',
  CONTRIB_FAL: 'FAL',
  CONTRIB_ART: 'ART',
  CONTRIB_SCVO: 'SCVO',
  APORTE_SIPA: 'Ap. SIPA',
  APORTE_INSSJP: 'Ap. INSSJP',
  APORTE_OBRA_SOCIAL: 'Ap. O. Social',
  APORTE_FSR: 'Ap. FSR',
};

export function PanelControlF931({ control, clienteId }: { control: ControlF931; clienteId: string }) {
  const { resumen } = control;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Empleados" valor={resumen.cantidadEmpleados.toLocaleString('es-AR')} />
        <Tarjeta titulo="Remuneración total" valor={`$ ${pesos(resumen.remuneracionTotal)}`} />
        <Tarjeta titulo="Contribuciones calculadas" valor={`$ ${pesos(resumen.totalContribuciones)}`} />
        <Tarjeta titulo="Aportes calculados" valor={`$ ${pesos(resumen.totalAportes)}`} />
      </div>

      <Seccion
        titulo="Contribuciones patronales"
        accion={
          <Link
            href={`/clientes/${clienteId}/cargas-sociales`}
            className="text-xs font-medium text-crowe-magenta hover:underline"
          >
            Alícuotas del cliente: Cargas sociales →
          </Link>
        }
      >
        <TablaConceptos conceptos={control.contribuciones} total={resumen.totalContribuciones} />
      </Seccion>

      <Seccion titulo="Aportes personales">
        <TablaConceptos conceptos={control.aportes} total={resumen.totalAportes} />
      </Seccion>

      <Seccion titulo="Observaciones del control">
        {control.observaciones.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Sin observaciones.</p>
        ) : (
          <ul className="space-y-2">
            {control.observaciones.map((o) => (
              <li key={o.titulo} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <SeveridadBadge severidad={o.severidad} />
                  <span className="font-medium">{o.titulo}</span>
                  <span className="text-xs text-slate-400">· {o.empleados.length} empleado(s)</span>
                </div>
                <p className="mt-1 text-slate-600">{o.detalle}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {o.empleados.map((e) => `${e.nombre} (leg. ${e.legajo})`).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Bases imponibles del reporte">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Base</th>
                <th className="px-4 py-2 font-medium">Se usa para</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {control.bases.map((b) => (
                <tr key={b.base}>
                  <td className="px-4 py-2 font-medium">{b.etiqueta}</td>
                  <td className="px-4 py-2 text-slate-600">{b.descripcion}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pesos(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Detalle por empleado">
        <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-crowe-indigo">
            Ver los {control.empleados.length} empleados
          </summary>
          <div className="overflow-x-auto border-t border-slate-200">
            <table className="w-full whitespace-nowrap text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Leg.</th>
                  <th className="px-3 py-2 font-medium">Empleado</th>
                  <th className="px-3 py-2 font-medium">CUIL</th>
                  <th className="px-3 py-2 font-medium">Contrato</th>
                  <th className="px-3 py-2 text-right font-medium">Rem. total</th>
                  <th className="px-3 py-2 text-right font-medium">Rem. 1</th>
                  <th className="px-3 py-2 text-right font-medium">Rem. 10</th>
                  <th className="px-3 py-2 text-right font-medium">Detracción</th>
                  {control.contribuciones.map((c) => (
                    <th key={c.codigo} className="px-3 py-2 text-right font-medium" title={c.descripcion}>
                      {COLUMNA_CONCEPTO[c.codigo] ?? c.codigo}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Total contrib.</th>
                  {control.aportes.map((a) => (
                    <th key={a.codigo} className="px-3 py-2 text-right font-medium" title={a.descripcion}>
                      {COLUMNA_CONCEPTO[a.codigo] ?? a.codigo}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Total aportes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {control.empleados.map((e) => (
                  <tr key={e.cuil}>
                    <td className="px-3 py-1.5">{e.legajo}</td>
                    <td className="px-3 py-1.5">{e.nombre}</td>
                    <td className="px-3 py-1.5 tabular-nums">{e.cuil}</td>
                    <td className="px-3 py-1.5">{e.modalidadContratacion}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pesos(e.remuneracionTotal)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pesos(e.bases.remuneracion1)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pesos(e.bases.remuneracion10)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{pesos(e.totalDetraer)}</td>
                    {control.contribuciones.map((c) => (
                      <td key={c.codigo} className="px-3 py-1.5 text-right tabular-nums">
                        {pesos(e.contribuciones[c.codigo])}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">{pesos(e.totalContribuciones)}</td>
                    {control.aportes.map((a) => (
                      <td key={a.codigo} className="px-3 py-1.5 text-right tabular-nums">
                        {pesos(e.aportes[a.codigo])}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">{pesos(e.totalAportes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Seccion>
    </div>
  );
}
