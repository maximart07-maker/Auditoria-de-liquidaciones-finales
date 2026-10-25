import Link from 'next/link';
import { apiClient, ControlDeLeyes } from '@/lib/api-client';
import { BotonVolver } from '@/components/ui/boton-volver';
import { ImportarReporteF931 } from '@/components/nomina-mensual/importar-reporte-f931';
import { PanelControlF931 } from '@/components/nomina-mensual/panel-control-f931';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const nombrePeriodo = (periodo: string) => {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
};

/** Nómina mensual › Control de Leyes: conceptos de seguridad social del F.931 a partir
 * del reporte del sistema de liquidación. Ver docs/motor-calculo.md §11. */
export default async function ControlDeLeyesPage({
  params,
  searchParams,
}: {
  params: { clienteId: string };
  searchParams: { periodo?: string };
}) {
  const [cliente, reportes] = await Promise.all([
    apiClient.obtenerCliente(params.clienteId),
    apiClient.listarReportesF931(params.clienteId),
  ]);
  const periodo = reportes.find((r) => r.periodo === searchParams.periodo)?.periodo ?? reportes[0]?.periodo ?? null;
  const datos: ControlDeLeyes | null = periodo ? await apiClient.obtenerControlDeLeyes(cliente.id, periodo) : null;
  const base = `/clientes/${cliente.id}/nomina-mensual/control-de-leyes`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BotonVolver href={`/clientes/${cliente.id}/nomina-mensual`}>Volver a Nómina mensual</BotonVolver>
        <p className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Clientes
          </Link>{' '}
          /{' '}
          <Link href={`/clientes/${cliente.id}`} className="hover:underline">
            {cliente.razonSocial}
          </Link>{' '}
          /{' '}
          <Link href={`/clientes/${cliente.id}/nomina-mensual`} className="hover:underline">
            Nómina mensual
          </Link>{' '}
          / Control de Leyes
        </p>
        <h1 className="text-xl font-semibold">Control de Leyes — {cliente.razonSocial}</h1>
        <p className="text-sm text-slate-500">
          Conceptos de seguridad social del F.931 calculados a partir del reporte del sistema de liquidación.
        </p>
      </div>

      <ImportarReporteF931 clienteId={cliente.id} />

      {reportes.length > 0 && (
        <nav aria-label="Períodos importados" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wide text-slate-500">Período</span>
          {reportes.map((r) => (
            <Link
              key={r.periodo}
              href={`${base}?periodo=${r.periodo}`}
              aria-current={r.periodo === periodo ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 capitalize ${
                r.periodo === periodo
                  ? 'border-crowe-indigo bg-crowe-indigo text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-crowe-magenta'
              }`}
            >
              {nombrePeriodo(r.periodo)}
            </Link>
          ))}
        </nav>
      )}

      {!datos && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
          Todavía no hay reportes importados. Subí el reporte del sistema de liquidación para ver el panel.
        </div>
      )}

      {datos && !datos.cargasSocialesConfiguradas && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Para calcular las contribuciones hace falta configurar las{' '}
          <Link href={`/clientes/${cliente.id}/cargas-sociales`} className="font-medium underline">
            cargas sociales del cliente
          </Link>
          .
        </p>
      )}

      {datos?.control && <PanelControlF931 control={datos.control} clienteId={cliente.id} />}
    </div>
  );
}
