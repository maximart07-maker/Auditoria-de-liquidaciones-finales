import { apiClient } from '@/lib/api-client';
import { CasoTabs } from '@/components/caso-tabs';

export default async function FichaCasoPage({ params }: { params: { casoId: string } }) {
  const caso = await apiClient.obtenerCaso(params.casoId);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Caso</p>
        <h1 className="text-xl font-semibold">{caso.empleado.nombre}</h1>
      </div>
      <CasoTabs caso={caso} />
    </div>
  );
}
