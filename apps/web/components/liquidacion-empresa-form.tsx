'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rubro, RubroLiquidacion, apiClient } from '@/lib/api-client';

/** Carga la liquidación declarada por la empresa (lo que realmente pagó), rubro
 * por rubro, para que la auditoría la compare contra lo calculado por el motor. */
export function LiquidacionEmpresaForm({ casoId, rubrosDeclarados }: { casoId: string; rubrosDeclarados: RubroLiquidacion[] }) {
  const router = useRouter();
  const [catalogo, setCatalogo] = useState<Rubro[]>([]);
  const [filas, setFilas] = useState<{ rubroCodigo: string; monto: string }[]>([{ rubroCodigo: '', monto: '' }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.listarRubros().then(setCatalogo).catch(() => {});
  }, []);

  function actualizarFila(i: number, campo: 'rubroCodigo' | 'monto', valor: string) {
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));
  }

  function agregarFila() {
    setFilas((prev) => [...prev, { rubroCodigo: '', monto: '' }]);
  }

  function quitarFila(i: number) {
    setFilas((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    const rubros = filas
      .filter((f) => f.rubroCodigo && f.monto)
      .map((f) => ({ rubroCodigo: f.rubroCodigo, monto: Number(f.monto) }));
    if (rubros.length === 0) {
      setError('Cargá al menos un rubro con su monto.');
      return;
    }
    setGuardando(true);
    try {
      await apiClient.guardarLiquidacionEmpresa(casoId, rubros);
      router.refresh();
      setFilas([{ rubroCodigo: '', monto: '' }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-600">Declarado por la empresa</h3>
        <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
          <tbody className="divide-y divide-slate-100">
            {rubrosDeclarados.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-2">{r.rubro.nombre}</td>
                <td className="px-4 py-2 text-right">${Number(r.monto).toLocaleString('es-AR')}</td>
              </tr>
            ))}
            {rubrosDeclarados.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                  Sin rubros cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={guardar} className="space-y-2 rounded-lg border border-dashed border-slate-300 p-4">
        <p className="text-xs text-slate-500">
          Cargá una nueva versión de la liquidación de la empresa (reemplaza a la vigente).
        </p>
        {filas.map((fila, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-slate-500">Rubro</label>
              <select
                className="w-64 rounded border border-slate-300 px-2 py-1 text-sm"
                value={fila.rubroCodigo}
                onChange={(e) => actualizarFila(i, 'rubroCodigo', e.target.value)}
              >
                <option value="">Elegir…</option>
                {catalogo.map((r) => (
                  <option key={r.codigo} value={r.codigo}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Monto ($)</label>
              <input
                className="w-36 rounded border border-slate-300 px-2 py-1 text-sm"
                value={fila.monto}
                onChange={(e) => actualizarFila(i, 'monto', e.target.value)}
              />
            </div>
            {filas.length > 1 && (
              <button type="button" onClick={() => quitarFila(i)} className="text-xs text-red-600 hover:underline">
                Quitar
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button type="button" onClick={agregarFila} className="text-sm text-slate-600 hover:underline">
            + Agregar rubro
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar liquidación'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </div>
  );
}
