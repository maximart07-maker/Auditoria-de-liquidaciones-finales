import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { BotonVolver } from '@/components/ui/boton-volver';

/** Nómina mensual › Control de Leyes. */
export default async function ControlDeLeyesPage({ params }: { params: { clienteId: string } }) {
  const cliente = await apiClient.obtenerCliente(params.clienteId);

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
          Verifica que la liquidación mensual cumpla con la normativa laboral vigente.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-400">
        Todavía no hay controles configurados.
      </div>
    </div>
  );
}
