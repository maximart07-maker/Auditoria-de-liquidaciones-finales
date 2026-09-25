'use client';

import { FormEvent, useState } from 'react';
import { ResumenImportacion, apiClient } from '@/lib/api-client';

/** Importa el histórico de nómina (un renglón por concepto liquidado, por
 * empleado y período — columnas: Doc, Apellido y Nombre, Período, Ingreso,
 * Categoría, Proceso, Concepto, Monto, TIPO) y lo vuelca en `RemuneracionMensual`
 * por empleado, dando de alta los que no existan. Ver docs/motor-calculo.md §2.2. */
export function ImportarNomina({ clienteId }: { clienteId: string }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResumenImportacion | null>(null);
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
      const resumen = await apiClient.importarNomina(clienteId, archivo);
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
        Subí el archivo de nómina (.xlsx) con un renglón por concepto liquidado, por empleado y período. Columnas
        esperadas: <code className="font-mono">Doc, Apellido y Nombre, Período, Ingreso, Categoría, Proceso, Concepto,
        Monto, TIPO</code>. Se suman los conceptos <code className="font-mono">REMU</code> por empleado y mes para
        cargar el histórico de remuneraciones (art. 245 LCT); si el CUIL no existe todavía como empleado de este
        cliente, se da de alta automáticamente.
      </p>
      <p className="text-xs text-slate-500">
        Opcional: una columna <code className="font-mono">Imputación</code> con el mes de devengamiento (MM/AAAA,
        AAAA-MM o fecha). Si la trae, cada concepto suma al mes al que se imputa y no al mes en que se pagó; así un
        retroactivo integra la remuneración del mes que corresponde.
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
          {importando ? 'Importando…' : 'Importar nómina'}
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
              <dt className="text-xs text-slate-500">Filas procesadas</dt>
              <dd>{resultado.filasProcesadas.toLocaleString('es-AR')}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Empleados detectados</dt>
              <dd>{resultado.empleadosDetectados.toLocaleString('es-AR')}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Empleados nuevos</dt>
              <dd>{resultado.empleadosCreados.toLocaleString('es-AR')}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Empleados actualizados</dt>
              <dd>{resultado.empleadosActualizados.toLocaleString('es-AR')}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Meses de remuneración cargados</dt>
              <dd>{resultado.mesesImportados.toLocaleString('es-AR')}</dd>
            </div>
          </dl>
          {resultado.errores.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-red-600">{resultado.errores.length} fila(s) con error:</p>
              <ul className="list-inside list-disc text-xs text-red-600">
                {resultado.errores.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {resultado.advertencias.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-amber-700">{resultado.advertencias.length} advertencia(s):</p>
              <ul className="list-inside list-disc text-xs text-amber-700">
                {resultado.advertencias.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
