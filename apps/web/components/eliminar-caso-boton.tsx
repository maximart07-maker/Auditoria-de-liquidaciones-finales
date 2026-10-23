'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

/** Con `redirigirA`, navega ahí después de borrar (p.ej. desde la ficha del
 * caso, que deja de existir); sin él, refresca la pantalla actual. */
export function EliminarCasoBoton({
  casoId,
  nombreEmpleado,
  redirigirA,
  compacto = false,
}: {
  casoId: string;
  nombreEmpleado: string;
  redirigirA?: string;
  compacto?: boolean;
}) {
  const router = useRouter();
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function eliminar() {
    const confirmado = window.confirm(
      `¿Eliminar el caso de ${nombreEmpleado}? Se borran también sus variables, liquidaciones y auditorías. ` +
        'El empleado y su historial de remuneraciones no se tocan. Esta acción no se puede deshacer.',
    );
    if (!confirmado) return;

    setEliminando(true);
    setError(null);
    try {
      await apiClient.eliminarCaso(casoId);
      if (redirigirA) router.push(redirigirA);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setEliminando(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={eliminar}
        disabled={eliminando}
        className={
          compacto
            ? 'text-xs font-medium text-red-600 hover:underline disabled:opacity-50'
            : 'rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50'
        }
      >
        {eliminando ? 'Eliminando…' : 'Eliminar caso'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
