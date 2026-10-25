'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResultadoImportacionReporteF931, apiClient } from '@/lib/api-client';

/** Importa el reporte de bases del F.931 que exporta el sistema de liquidación (CSV con ";"). */
export function ImportarReporteF931({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacionReporteF931 | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importar(evento: FormEvent) {
    evento.preventDefault();
    if (!archivo) {
      setError('Elegí primero el reporte (.csv) a importar.');
      return;
    }
    setImportando(true);
    setError(null);
    setResultado(null);
    try {
      const r = await apiClient.importarReporteF931(clienteId, archivo);
      setResultado(r);
      const ultimo = r.periodos[r.periodos.length - 1];
      if (ultimo) router.push(`/clientes/${clienteId}/nomina-mensual/control-de-leyes?periodo=${ultimo.periodo}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImportando(false);
    }
  }

  const mensajes = resultado ? [...resultado.errores, ...resultado.advertencias] : [];

  return (
    <div className="space-y-3">
      <form
        onSubmit={importar}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-4"
      >
        <div className="min-w-0 flex-1">
          <label className="block text-xs text-slate-500">Reporte del sistema de liquidación (.csv separado por ;)</label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="max-w-full text-sm"
          />
          <p className="mt-1 text-xs text-slate-400">
            Un renglón por empleado con Período, CUIL, Contrato, Condición SIJP, Remuneración Total, Remuneración 1 a 10
            y montos a detraer. Si el período ya estaba importado, se reemplaza.
          </p>
        </div>
        <button type="submit" disabled={importando} className="btn-primario">
          {importando ? 'Importando…' : 'Importar reporte'}
        </button>
      </form>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {resultado && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {resultado.periodos
            .map(
              (p) =>
                `${p.periodo}: ${p.cantidadEmpleados} empleados importados${p.reemplazado ? ' (reemplazó la importación anterior)' : ''}`,
            )
            .join(' · ')}
          {mensajes.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
              {mensajes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
