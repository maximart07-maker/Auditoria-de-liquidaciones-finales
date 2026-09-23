'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VariableCaso, apiClient } from '@/lib/api-client';

/** Las claves que el motor de cálculo necesita (ver docs/motor-calculo.md §2) —
 * la MRMNH no está acá porque se deriva del histórico de remuneraciones, y
 * sueldoMensualActual es opcional: si no se carga, se autocompleta con la
 * remuneración del mes de egreso (filtrada por el catálogo de conceptos).
 * diasVacacionesCorrespondientesManual también es opcional: solo hace falta
 * si el cliente le reconoce a este empleado más días de vacaciones que los
 * que corresponden por LCT/convenio (nunca baja ese piso, solo puede subirlo —
 * ver §4.5 y ConfiguracionRubros para el piso por convenio a nivel cliente). */
function valorDe(variables: VariableCaso[], clave: string): string {
  return variables.find((v) => v.clave === clave)?.valor ?? '';
}

export function VariablesCasoForm({ casoId, variables }: { casoId: string; variables: VariableCaso[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    sueldoMensualActual: valorDe(variables, 'sueldoMensualActual'),
    diasVacacionesGozadosEnElAnio: valorDe(variables, 'diasVacacionesGozadosEnElAnio'),
    preavisoOtorgado: valorDe(variables, 'preavisoOtorgado') === 'true',
    diasVacacionesPendientesPeriodosAnteriores: valorDe(variables, 'diasVacacionesPendientesPeriodosAnteriores'),
    diasVacacionesCorrespondientesManual: valorDe(variables, 'diasVacacionesCorrespondientesManual'),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (!form.diasVacacionesGozadosEnElAnio) {
      setError('Completá al menos los días de vacaciones gozados en el año.');
      return;
    }
    setGuardando(true);
    try {
      await Promise.all([
        ...(form.sueldoMensualActual
          ? [
              apiClient.guardarVariable(casoId, {
                clave: 'sueldoMensualActual',
                valor: form.sueldoMensualActual,
                fuente: 'manual',
              }),
            ]
          : []),
        apiClient.guardarVariable(casoId, {
          clave: 'diasVacacionesGozadosEnElAnio',
          valor: form.diasVacacionesGozadosEnElAnio,
          fuente: 'manual',
        }),
        apiClient.guardarVariable(casoId, {
          clave: 'preavisoOtorgado',
          valor: String(form.preavisoOtorgado),
          fuente: 'manual',
        }),
        ...(form.diasVacacionesPendientesPeriodosAnteriores
          ? [
              apiClient.guardarVariable(casoId, {
                clave: 'diasVacacionesPendientesPeriodosAnteriores',
                valor: form.diasVacacionesPendientesPeriodosAnteriores,
                fuente: 'manual',
              }),
            ]
          : []),
        ...(form.diasVacacionesCorrespondientesManual
          ? [
              apiClient.guardarVariable(casoId, {
                clave: 'diasVacacionesCorrespondientesManual',
                valor: form.diasVacacionesCorrespondientesManual,
                fuente: 'manual',
              }),
            ]
          : []),
      ]);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Clave</th>
            <th className="px-4 py-2 font-medium">Valor</th>
            <th className="px-4 py-2 font-medium">Fuente</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {variables.map((v) => (
            <tr key={v.id} className={v.fuente === 'ocr' && Number(v.confianza) < 0.75 ? 'bg-amber-50' : ''}>
              <td className="px-4 py-2 font-mono text-xs">{v.clave}</td>
              <td className="px-4 py-2">{v.valor}</td>
              <td className="px-4 py-2 text-xs text-slate-500">{v.fuente}</td>
            </tr>
          ))}
          {variables.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                Sin variables cargadas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form onSubmit={guardar} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4">
        <div>
          <label className="block text-xs text-slate-500">
            Sueldo mensual actual ($) <span className="text-slate-400">— opcional</span>
          </label>
          <input
            className="w-36 rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="auto (del recibo)"
            value={form.sueldoMensualActual}
            onChange={(e) => setForm((prev) => ({ ...prev, sueldoMensualActual: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Días de vacaciones gozados en el año</label>
          <input
            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
            value={form.diasVacacionesGozadosEnElAnio}
            onChange={(e) => setForm((prev) => ({ ...prev, diasVacacionesGozadosEnElAnio: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">Días pendientes de períodos anteriores (opcional)</label>
          <input
            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
            value={form.diasVacacionesPendientesPeriodosAnteriores}
            onChange={(e) => setForm((prev) => ({ ...prev, diasVacacionesPendientesPeriodosAnteriores: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">
            Días anuales que corresponden, si superan ley/convenio <span className="text-slate-400">— opcional</span>
          </label>
          <input
            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="auto (LCT/convenio)"
            value={form.diasVacacionesCorrespondientesManual}
            onChange={(e) => setForm((prev) => ({ ...prev, diasVacacionesCorrespondientesManual: e.target.value }))}
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.preavisoOtorgado}
            onChange={(e) => setForm((prev) => ({ ...prev, preavisoOtorgado: e.target.checked }))}
          />
          Preaviso otorgado
        </label>
        <button
          type="submit"
          disabled={guardando}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar variables'}
        </button>
        {error && <p className="w-full text-xs text-red-600">{error}</p>}
      </form>
    </div>
  );
}
