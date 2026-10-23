import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { BotonVolver } from '@/components/ui/boton-volver';
import { ConfiguracionCargasSociales } from '@/components/configuracion-cargas-sociales';

/** Dato propio del cliente (sección "Datos del cliente" del menú): parámetros de
 * cargas sociales que usan los controles posteriores de cada módulo. */
export default async function CargasSocialesClientePage({ params }: { params: { clienteId: string } }) {
  const cliente = await apiClient.obtenerCliente(params.clienteId);
  let cargasSociales: Awaited<ReturnType<typeof apiClient.obtenerCargasSociales>> | null = null;
  let error: string | null = null;
  try {
    cargasSociales = await apiClient.obtenerCargasSociales(params.clienteId);
  } catch (e) {
    error = (e as Error).message;
  }

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
          / Datos del cliente / Cargas sociales
        </p>
        <h1 className="text-xl font-semibold">Cargas sociales — {cliente.razonSocial}</h1>
        <p className="text-sm text-slate-500">
          Parámetros propios del cliente (SUSS, obra social, FAL, ART, SCVO, detracción y jornada) que se usan en los
          controles posteriores.
        </p>
      </div>

      {cargasSociales ? (
        <ConfiguracionCargasSociales clienteId={cliente.id} inicial={cargasSociales} />
      ) : (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">La API no devolvió la configuración de cargas sociales.</p>
          <p>
            Suele pasar cuando el backend quedó con la versión anterior o falta la tabla nueva. Aplicá la migración (
            <code>npm run prisma:migrate --workspace apps/api</code>), recompilá el motor (
            <code>npm run build --workspace packages/motor-calculo</code>) y reiniciá la API.
          </p>
          <p className="text-xs text-amber-700">Detalle: {error}</p>
        </div>
      )}
    </div>
  );
}
