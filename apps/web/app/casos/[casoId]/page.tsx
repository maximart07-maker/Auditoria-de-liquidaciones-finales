import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { esCasoEliminable } from '@/lib/casos';
import { CasoTabs } from '@/components/caso-tabs';
import { EliminarCasoBoton } from '@/components/eliminar-caso-boton';
import { BotonVolver } from '@/components/ui/boton-volver';
import { EstadoBadge } from '@/components/ui/estado-badge';

export default async function FichaCasoPage({ params }: { params: { casoId: string } }) {
  const caso = await apiClient.obtenerCaso(params.casoId);
  const cliente = await apiClient.obtenerCliente(caso.empleado.clienteId);
  const urlCliente = `/clientes/${cliente.id}`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BotonVolver href={urlCliente}>Volver a {cliente.razonSocial}</BotonVolver>
        <p className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Clientes
          </Link>{' '}
          /{' '}
          <Link href={urlCliente} className="hover:underline">
            {cliente.razonSocial}
          </Link>{' '}
          / Caso
        </p>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{caso.empleado.nombre}</h1>
            <EstadoBadge estado={caso.estado} />
          </div>
          {esCasoEliminable(caso.estado) && (
            <EliminarCasoBoton casoId={caso.id} nombreEmpleado={caso.empleado.nombre} redirigirA={urlCliente} />
          )}
        </div>
      </div>
      <CasoTabs caso={caso} />
    </div>
  );
}
