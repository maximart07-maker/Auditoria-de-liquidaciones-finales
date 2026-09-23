'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ResumenImportacionRecibo, apiClient } from '@/lib/api-client';

const TIPOS_EXTINCION = [
  'despido_sin_causa',
  'despido_con_causa',
  'renuncia',
  'mutuo_acuerdo',
  'vencimiento_contrato',
  'fallecimiento',
] as const;

/** Importa un recibo de sueldo (PDF) de liquidación final: da de alta al
 * empleado y crea el caso automáticamente. El recibo no trae el motivo ni la
 * fecha de extinción (no son datos de nómina) — se completan acá a mano. */
export function ImportarRecibo({ clienteId }: { clienteId: string }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [tipoExtincion, setTipoExtincion] = useState<string>('despido_sin_causa');
  const [fechaExtincion, setFechaExtincion] = useState('');
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResumenImportacionRecibo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (!archivo) {
      setError('Elegí primero el recibo (.pdf) a importar.');
      return;
    }
    if (!fechaExtincion) {
      setError('Completá la fecha de extinción.');
      return;
    }
    setImportando(true);
    setResultado(null);
    try {
      const resumen = await apiClient.importarRecibo(clienteId, archivo, tipoExtincion, fechaExtincion);
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
        Subí el recibo de sueldo (.pdf) de la liquidación final. El empleado y el caso se crean automáticamente a
        partir de los datos del recibo (CUIL, nombre, categoría, fecha de ingreso, y los rubros que trae: SAC
        proporcional, vacaciones no gozadas actuales/anteriores y su SAC). El motivo y la fecha de extinción no
        vienen en el recibo — se completan acá.
      </p>

      <form onSubmit={importar} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4">
        <div>
          <label className="block text-xs text-slate-500">Recibo (.pdf)</label>
          <input type="file" accept=".pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Motivo de la extinción</label>
          <select
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={tipoExtincion}
            onChange={(e) => setTipoExtincion(e.target.value)}
          >
            {TIPOS_EXTINCION.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">Fecha de extinción</label>
          <input
            type="date"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={fechaExtincion}
            onChange={(e) => setFechaExtincion(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={importando}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {importando ? 'Importando…' : 'Importar recibo'}
        </button>
      </form>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {resultado && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h3 className="font-semibold text-slate-700">Caso creado</h3>
          <p className="text-xs text-slate-500">
            Recibo de {resultado.empresaDelRecibo ?? 'empresa no identificada'} ({resultado.cuitDelRecibo ?? '—'})
          </p>
          <p>
            Empleado: <strong>{resultado.empleado.nombre}</strong> ({resultado.empleado.cuil}) —{' '}
            {resultado.empleado.creado ? 'dado de alta ahora' : 'ya existía'}
          </p>
          <p>
            <Link href={`/casos/${resultado.casoId}`} className="font-medium text-slate-900 hover:underline">
              Ver el caso →
            </Link>
          </p>

          <p>
            Base remunerativa del período ({resultado.remuneracionMensual.periodo}): $
            {resultado.remuneracionMensual.conceptosRemunerativos.toLocaleString('es-AR')} —{' '}
            {resultado.baseCalculadaConCatalogo
              ? 'calculada con el catálogo de conceptos del cliente (solo los que entran en la base del art. 245)'
              : 'el cliente no tiene catálogo de conceptos cargado: se usó el total "Remunerativo" del recibo, que puede incluir conceptos como el SAC que no entran en esa base'}
          </p>

          <div>
            <p className="text-xs font-medium text-slate-500">Rubros declarados por la empresa (del recibo)</p>
            <ul className="mt-1 space-y-0.5">
              {resultado.rubrosDeclarados.map((r, i) => (
                <li key={i}>
                  {r.concepto} → <span className="font-mono text-xs">{r.rubroCodigo}</span>: $
                  {r.monto.toLocaleString('es-AR')}
                </li>
              ))}
            </ul>
          </div>

          {resultado.rubrosLegalesNoEncontradosEnElRecibo.length > 0 && (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              El recibo no trae {resultado.rubrosLegalesNoEncontradosEnElRecibo.join(', ')} — quedan declarados en
              $0; si el sistema los calcula, la auditoría va a marcar una diferencia del 100%.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
