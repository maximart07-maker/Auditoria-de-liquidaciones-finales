import { apiClient } from '@/lib/api-client';
import { MenuCliente } from '@/components/menu-cliente';

export default async function ClienteLayout({
  params,
  children,
}: {
  params: { clienteId: string };
  children: React.ReactNode;
}) {
  const [cliente, cargasSociales] = await Promise.all([
    apiClient.obtenerCliente(params.clienteId),
    // Si la API todavía no tiene el endpoint, el menú se muestra igual (sin la marca).
    apiClient.obtenerCargasSociales(params.clienteId).catch(() => null),
  ]);

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <aside className="md:w-60 md:shrink-0">
        <div className="md:sticky md:top-6">
          <MenuCliente
            clienteId={cliente.id}
            razonSocial={cliente.razonSocial}
            cargasSocialesPendientes={cargasSociales !== null && !cargasSociales.configurado}
          />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
