import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { BotonVolver } from '@/components/ui/boton-volver';
import { ConfiguracionRubros } from '@/components/configuracion-rubros';

export default async function ConfiguracionClientePage({ params }: { params: { clienteId: string } }) {
  const [cliente, configuraciones] = await Promise.all([
    apiClient.obtenerCliente(params.clienteId),
    apiClient.listarConfiguracionesRubro(params.clienteId),
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
          / Configuración de conceptos
        </p>
        <h1 className="text-xl font-semibold">Conceptos fijos y variables — {cliente.razonSocial}</h1>
      </div>

      <ConfiguracionRubros clienteId={cliente.id} inicial={configuraciones} />
    </div>
  );
}
