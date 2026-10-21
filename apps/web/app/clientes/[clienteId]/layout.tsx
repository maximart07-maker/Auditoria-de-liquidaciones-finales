import { apiClient } from '@/lib/api-client';
import { MenuCliente } from '@/components/menu-cliente';

export default async function ClienteLayout({
  params,
  children,
}: {
  params: { clienteId: string };
  children: React.ReactNode;
}) {
  const cliente = await apiClient.obtenerCliente(params.clienteId);

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <aside className="md:w-60 md:shrink-0">
        <div className="md:sticky md:top-6">
          <MenuCliente clienteId={cliente.id} razonSocial={cliente.razonSocial} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
