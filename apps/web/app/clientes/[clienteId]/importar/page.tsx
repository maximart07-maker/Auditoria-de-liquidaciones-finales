import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { ImportarConceptos } from '@/components/importar-conceptos';
import { ImportarNomina } from '@/components/importar-nomina';
import { ImportarRecibo } from '@/components/importar-recibo';

export default async function ImportarNominaPage({ params }: { params: { clienteId: string } }) {
  const cliente = await apiClient.obtenerCliente(params.clienteId);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Clientes
          </Link>{' '}
          /{' '}
          <Link href={`/clientes/${cliente.id}`} className="hover:underline">
            {cliente.razonSocial}
          </Link>{' '}
          / Importar
        </p>
        <h1 className="text-xl font-semibold">Importar — {cliente.razonSocial}</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Catálogo de conceptos del cliente
        </h2>
        <ImportarConceptos clienteId={cliente.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nómina (histórico mensual)</h2>
        <ImportarNomina clienteId={cliente.id} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recibo de liquidación final (crea el caso)
        </h2>
        <ImportarRecibo clienteId={cliente.id} />
      </section>
    </div>
  );
}
