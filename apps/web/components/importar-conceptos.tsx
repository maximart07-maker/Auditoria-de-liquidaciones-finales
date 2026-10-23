'use client';

import { FormEvent, useState } from 'react';
import { ResumenImportacionConceptos, apiClient } from '@/lib/api-client';

/** Importa el catálogo propio del cliente para los códigos de concepto de su
 * sistema de nómina (columnas: Código, Descripción, Tipo, Característica,
 * Base Indemnización). Los códigos no son un estándar — cada cliente los
 * numera distinto — así que este catálogo es lo que permite saber, código
 * por código, si un concepto entra en la base del art. 245 LCT (MRMNH), en
 * vez de asumirlo por si es remunerativo (p.ej. el SAC es remunerativo pero
 * no entra en esa base). Conviene cargarlo antes de importar la nómina o un
 * recibo de este cliente. Ver docs/motor-calculo.md §2.4. */
export function ImportarConceptos({ clienteId }: { clienteId: string }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResumenImportacionConceptos | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importar(evento: FormEvent) {
    evento.preventDefault();
    if (!archivo) {
      setError('Elegí primero el archivo .xlsx a importar.');
      return;
    }
    setImportando(true);
    setError(null);
    setResultado(null);
    try {
      const resumen = await apiClient.importarConceptos(clienteId, archivo);
      setResultado(resumen);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Subí el catálogo de conceptos del cliente (.xlsx, hoja &quot;Conceptos&quot;). Columnas esperadas:{' '}
        <code className="font-mono">Código, Descripción, Tipo, Característica, Base Indemnización</code>. La
        importación es idempotente por código: reimportar actualiza los conceptos ya cargados.
      </p>

      <form onSubmit={importar} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4">
        <div>
          <label className="block text-xs text-slate-500">Archivo (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={importando}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {importando ? 'Importando…' : 'Importar conceptos'}
        </button>
      </form>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {resultado && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h3 className="font-semibold text-slate-700">Importación completada</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">Conceptos procesados</dt>
              <dd>{resultado.conceptosProcesados.toLocaleString('es-AR')}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Nuevos</dt>
              <dd>{resultado.conceptosCreados.toLocaleString('es-AR')}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Actualizados</dt>
              <dd>{resultado.conceptosActualizados.toLocaleString('es-AR')}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
