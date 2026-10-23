import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { BotonVolver } from '@/components/ui/boton-volver';
import { ConfiguracionCargasSociales } from '@/components/configuracion-cargas-sociales';

export default async function CargasSocialesClientePage({ params }: { params: { clienteId: string } }) {
  const [cliente, cargasSociales] = await Promise.all([
    apiClient.obtenerCliente(params.clienteId),
    apiClient.obtenerCargasSociales(params.clienteId),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BotonVolver href={`/clientes/${cliente.id}`}>Volver a {cliente.razonSocial}</BotonVolver>
        <p className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Clientes
          </Link>{' '}
          /{' '}
          <Link href={`/clientes/${cliente.id}`} className="hover:underline">
            {cliente.razonSocial}
          </Link>{' '}
          / Cargas sociales
        </p>
        <h1 className="text-xl font-semibold">Cargas sociales y costo laboral — {cliente.razonSocial}</h1>
      </div>

      <ConfiguracionCargasSociales clienteId={cliente.id} inicial={cargasSociales} />
    </div>
  );
}
