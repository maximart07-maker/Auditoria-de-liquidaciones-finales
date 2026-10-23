import { apiClient } from '@/lib/api-client';
import { ConfiguracionRubros } from '@/components/configuracion-rubros';

export default async function ConfiguracionClientePage({ params }: { params: { clienteId: string } }) {
  const [cliente, configuraciones] = await Promise.all([
    apiClient.obtenerCliente(params.clienteId),
    apiClient.listarConfiguracionesRubro(params.clienteId),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Conceptos fijos y variables</h2>

      <ConfiguracionRubros clienteId={cliente.id} inicial={configuraciones} />
    </div>
  );
}
