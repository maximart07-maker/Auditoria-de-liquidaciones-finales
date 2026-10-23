'use client';

import { FormEvent, useState } from 'react';
import { RemuneracionMensual, apiClient } from '@/lib/api-client';

/** Histórico mensual de remuneraciones, base para que el motor derive la MRMNH
 * (mejor remuneración mensual, normal y habitual — art. 245 LCT) en vez de que
 * se cargue un único número a mano. Ver docs/motor-calculo.md §2.1. */
export function RemuneracionesMensuales({ empleadoId, inicial }: { empleadoId: string; inicial: RemuneracionMensual[] }) {
  const [remuneraciones, setRemuneraciones] = useState(
    [...inicial].sort((a, b) => a.periodo.localeCompare(b.periodo)),
  );
  const [form, setForm] = useState({ periodo: '', conceptosRemunerativos: '', esNormalYHabitual: true });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    const monto = Number(form.conceptosRemunerativos);
    if (!form.periodo || Number.isNaN(monto)) {
      setError('Completá el período y un monto numérico válido.');
      return;
    }
    setGuardando(true);
    try {
      const guardada = await apiClient.guardarRemuneracionMensual(empleadoId, form.periodo, {
        conceptosRemunerativos: monto,
        esNormalYHabitual: form.esNormalYHabitual,
        fuente: 'manual',
      });
      setRemuneraciones((prev) =>
        [...prev.filter((r) => r.periodo !== guardada.periodo), guardada].sort((a, b) => a.periodo.localeCompare(b.periodo)),
      );
      setForm({ periodo: '', conceptosRemunerativos: '', esNormalYHabitual: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(periodo: string) {
    setGuardando(true);
    try {
      await apiClient.eliminarRemuneracionMensual(empleadoId, periodo);
      setRemuneraciones((prev) => prev.filter((r) => r.periodo !== periodo));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Cargá el mes que corresponda de remuneración (básico, horas extra, comisiones, premios habituales). El motor de
        cálculo toma automáticamente el mayor mes marcado como &quot;normal y habitual&quot; dentro del último año
        trabajado como MRMNH (art. 245 LCT) — no hace falta calcularla a mano.
      </p>

      <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Período</th>
            <th className="px-4 py-2 font-medium">Conceptos remunerativos</th>
            <th className="px-4 py-2 font-medium">Normal y habitual</th>
            <th className="px-4 py-2 font-medium">Fuente</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {remuneraciones.map((r) => (
            <tr key={r.periodo} className={!r.esNormalYHabitual ? 'bg-amber-50' : ''}>
              <td className="px-4 py-2">
                {new Date(r.periodo).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', timeZone: 'UTC' })}
              </td>
              <td className="px-4 py-2">${Number(r.conceptosRemunerativos).toLocaleString('es-AR')}</td>
              <td className="px-4 py-2">{r.esNormalYHabitual ? 'Sí' : 'No (excluido de la MRMNH)'}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{r.fuente}</td>
              <td className="px-4 py-2">
                <button
                  disabled={guardando}
                  onClick={() => eliminar(r.periodo)}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Quitar
                </button>
              </td>
            </tr>
          ))}
          {remuneraciones.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                Sin remuneraciones cargadas todavía — la auditoría no podrá calcular la MRMNH hasta cargar al menos un mes.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form onSubmit={agregar} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3">
        <div>
          <label className="block text-xs text-slate-500">Período</label>
          <input
            type="month"
            className="rounded border border-slate-300 px-2 py-1 text-sm"
            value={form.periodo ? form.periodo.slice(0, 7) : ''}
            onChange={(e) => setForm((prev) => ({ ...prev, periodo: e.target.value ? `${e.target.value}-01` : '' }))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Conceptos remunerativos ($)</label>
          <input
            className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="100000"
            value={form.conceptosRemunerativos}
            onChange={(e) => setForm((prev) => ({ ...prev, conceptosRemunerativos: e.target.value }))}
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.esNormalYHabitual}
            onChange={(e) => setForm((prev) => ({ ...prev, esNormalYHabitual: e.target.checked }))}
          />
          Normal y habitual
        </label>
        <button
          type="submit"
          disabled={guardando}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Cargar mes
        </button>
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </form>
    </div>
  );
}
