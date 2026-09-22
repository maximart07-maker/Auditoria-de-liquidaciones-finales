import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { ImportarNomina } from '@/components/importar-nomina';

export default async function ImportarNominaPage({ params }: { params: { clienteId: string } }) {
  const cliente = await apiClient.obtenerCliente(params.clienteId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Clientes
          </Link>{' '}
          /{' '}
          <Link href={`/clientes/${cliente.id}`} className="hover:underline">
            {cliente.razonSocial}
          </Link>{' '}
          / Importar nómina
        </p>
        <h1 className="text-xl font-semibold">Importar nómina — {cliente.razonSocial}</h1>
      </div>

      <ImportarNomina clienteId={cliente.id} />
    </div>
  );
}
