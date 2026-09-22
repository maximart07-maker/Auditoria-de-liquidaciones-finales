import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { EstadoBadge } from '@/components/ui/estado-badge';

export default async function PanelClientePage({ params }: { params: { clienteId: string } }) {
  const [cliente, casos] = await Promise.all([
    apiClient.obtenerCliente(params.clienteId),
    apiClient.listarCasosIndividuales(params.clienteId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Clientes
          </Link>{' '}
          / {cliente.razonSocial}
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{cliente.razonSocial}</h1>
          <Link
            href={`/clientes/${cliente.id}/configuracion`}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
          >
            Configurar conceptos fijos y variables
          </Link>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Casos individuales</h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Empleado</th>
                <th className="px-4 py-2 font-medium">Tipo de extinción</th>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {casos.map((caso) => (
                <tr key={caso.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/casos/${caso.id}`} className="font-medium hover:underline">
                      {caso.empleado.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{caso.tipoExtincion.replaceAll('_', ' ')}</td>
                  <td className="px-4 py-2">{new Date(caso.fechaExtincion).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-2">
                    <EstadoBadge estado={caso.estado} />
                  </td>
                </tr>
              ))}
              {casos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Sin casos individuales todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
