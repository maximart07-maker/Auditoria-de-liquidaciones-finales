import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { BotonVolver } from '@/components/ui/boton-volver';
import { MenuCliente } from '@/components/menu-cliente';

/** Encabezado con los datos del cliente y el menú de sus pantallas. */
export default async function ClienteLayout({ params, children }: { params: { clienteId: string }; children: React.ReactNode }) {
  const [cliente, cargasSociales] = await Promise.all([
    apiClient.obtenerCliente(params.clienteId),
    apiClient.obtenerCargasSociales(params.clienteId).catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BotonVolver href="/">Volver a clientes</BotonVolver>
        <p className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Clientes
          </Link>{' '}
          / {cliente.razonSocial}
        </p>
        <div>
          <h1 className="text-xl font-semibold">{cliente.razonSocial}</h1>
          <p className="text-sm text-slate-500">
            CUIT {cliente.cuit}
            {cliente.industria ? ` · ${cliente.industria}` : ''}
          </p>
        </div>
        <MenuCliente clienteId={cliente.id} cargasSocialesConfiguradas={cargasSociales?.configurado ?? null} />
      </div>
      {children}
    </div>
  );
}
