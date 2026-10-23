import { apiClient } from '@/lib/api-client';
import { ConfiguracionCargasSociales } from '@/components/configuracion-cargas-sociales';

export default async function CargasSocialesClientePage({ params }: { params: { clienteId: string } }) {
  let cargasSociales: Awaited<ReturnType<typeof apiClient.obtenerCargasSociales>> | null = null;
  let error: string | null = null;
  try {
    cargasSociales = await apiClient.obtenerCargasSociales(params.clienteId);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Cargas sociales y costo laboral</h2>
      {cargasSociales ? (
        <ConfiguracionCargasSociales clienteId={params.clienteId} inicial={cargasSociales} />
      ) : (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">La API no devolvió la configuración de cargas sociales.</p>
          <p>
            Suele pasar cuando el backend quedó con la versión anterior o falta la tabla nueva. Aplicá la migración (
            <code>npm run prisma:migrate --workspace apps/api</code>), recompilá el motor (
            <code>npm run build --workspace packages/motor-calculo</code>) y reiniciá <code>npm run dev:api</code>.
          </p>
          <p className="text-xs text-amber-700">Detalle: {error}</p>
        </div>
      )}
    </div>
  );
}
