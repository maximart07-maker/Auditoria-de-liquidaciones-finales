import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { BotonVolver } from '@/components/ui/boton-volver';

/** Portada del módulo Nómina mensual: acceso a sus menús. */
export default async function NominaMensualPage({ params }: { params: { clienteId: string } }) {
  const cliente = await apiClient.obtenerCliente(params.clienteId);
  const base = `/clientes/${cliente.id}/nomina-mensual`;

  const menus = [
    {
      titulo: 'Control de Leyes',
      descripcion: 'Conceptos de seguridad social del F.931 a partir del reporte del sistema de liquidación.',
      href: `${base}/control-de-leyes`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BotonVolver href="/">Volver a clientes</BotonVolver>
        <p className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Clientes
          </Link>{' '}
          /{' '}
          <Link href={`/clientes/${cliente.id}`} className="hover:underline">
            {cliente.razonSocial}
          </Link>{' '}
          / Nómina mensual
        </p>
        <h1 className="text-xl font-semibold">Nómina mensual — {cliente.razonSocial}</h1>
        <p className="text-sm text-slate-500">Auditoría de la liquidación de sueldos de cada mes.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {menus.map((menu) => (
          <li key={menu.href}>
            <Link
              href={menu.href}
              className="block h-full rounded-lg border border-slate-200 bg-white p-4 hover:border-crowe-magenta"
            >
              <span className="font-medium text-crowe-indigo">{menu.titulo}</span>
              <span className="mt-1 block text-sm text-slate-500">{menu.descripcion}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
