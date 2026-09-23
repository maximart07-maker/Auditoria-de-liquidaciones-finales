import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { CrearClienteForm } from '@/components/crear-cliente-form';

export default async function SeleccionClientePage() {
  let clientes: Awaited<ReturnType<typeof apiClient.listarClientes>> = [];
  let error: string | null = null;

  try {
    clientes = await apiClient.listarClientes();
  } catch {
    error = 'No se pudo conectar con la API. ¿Está corriendo `npm run dev:api`?';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <CrearClienteForm />
      </div>

      {error && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      )}

      {!error && clientes.length === 0 && (
        <p className="text-sm text-slate-500">Todavía no hay clientes cargados.</p>
      )}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {clientes.map((cliente) => (
          <li key={cliente.id}>
            <Link
              href={`/clientes/${cliente.id}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <span className="font-medium">{cliente.razonSocial}</span>
              <span className="text-sm text-slate-500">{cliente.cuit}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
