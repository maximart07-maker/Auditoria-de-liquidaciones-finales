'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Empleado, apiClient } from '@/lib/api-client';

const TIPOS_EXTINCION = [
  'despido_sin_causa',
  'despido_con_causa',
  'renuncia',
  'mutuo_acuerdo',
  'vencimiento_contrato',
  'fallecimiento',
] as const;

/** Alta manual de empleados y de casos individuales — el complemento del import
 * masivo de nómina para cuando se necesita cargar uno solo a mano. */
export function EmpleadosYCasos({ clienteId, inicial }: { clienteId: string; inicial: Empleado[] }) {
  const router = useRouter();
  const [empleados, setEmpleados] = useState(inicial);

  const [formEmpleado, setFormEmpleado] = useState({ nombre: '', cuil: '', fechaIngreso: '', categoria: '' });
  const [mostrarFormEmpleado, setMostrarFormEmpleado] = useState(false);
  const [guardandoEmpleado, setGuardandoEmpleado] = useState(false);
  const [errorEmpleado, setErrorEmpleado] = useState<string | null>(null);

  const [formCaso, setFormCaso] = useState({ empleadoId: '', tipoExtincion: 'despido_sin_causa', fechaExtincion: '' });
  const [mostrarFormCaso, setMostrarFormCaso] = useState(false);
  const [guardandoCaso, setGuardandoCaso] = useState(false);
  const [errorCaso, setErrorCaso] = useState<string | null>(null);

  async function crearEmpleado(evento: FormEvent) {
    evento.preventDefault();
    setErrorEmpleado(null);
    if (!formEmpleado.nombre.trim() || !formEmpleado.cuil.trim() || !formEmpleado.fechaIngreso) {
      setErrorEmpleado('Completá nombre, CUIL y fecha de ingreso.');
      return;
    }
    setGuardandoEmpleado(true);
    try {
      const empleado = await apiClient.crearEmpleado({
        clienteId,
        nombre: formEmpleado.nombre.trim(),
        cuil: formEmpleado.cuil.trim(),
        fechaIngreso: formEmpleado.fechaIngreso,
        categoria: formEmpleado.categoria.trim() || undefined,
      });
      setEmpleados((prev) => [...prev, empleado]);
      setFormEmpleado({ nombre: '', cuil: '', fechaIngreso: '', categoria: '' });
      setMostrarFormEmpleado(false);
    } catch (e) {
      setErrorEmpleado((e as Error).message);
    } finally {
      setGuardandoEmpleado(false);
    }
  }

  async function crearCaso(evento: FormEvent) {
    evento.preventDefault();
    setErrorCaso(null);
    if (!formCaso.empleadoId || !formCaso.fechaExtincion) {
      setErrorCaso('Elegí el empleado y la fecha de extinción.');
      return;
    }
    setGuardandoCaso(true);
    try {
      const caso = await apiClient.crearCaso({
        empleadoId: formCaso.empleadoId,
        tipoExtincion: formCaso.tipoExtincion,
        fechaExtincion: formCaso.fechaExtincion,
      });
      router.push(`/casos/${caso.id}`);
    } catch (e) {
      setErrorCaso((e as Error).message);
      setGuardandoCaso(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Empleados</h2>
          {!mostrarFormEmpleado && (
            <button
              onClick={() => setMostrarFormEmpleado(true)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              Nuevo empleado
            </button>
          )}
        </div>

        {mostrarFormEmpleado && (
          <form onSubmit={crearEmpleado} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4">
            <div>
              <label className="block text-xs text-slate-500">Nombre</label>
              <input
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={formEmpleado.nombre}
                onChange={(e) => setFormEmpleado((prev) => ({ ...prev, nombre: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">CUIL</label>
              <input
                className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="20304050607"
                value={formEmpleado.cuil}
                onChange={(e) => setFormEmpleado((prev) => ({ ...prev, cuil: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Fecha de ingreso</label>
              <input
                type="date"
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={formEmpleado.fechaIngreso}
                onChange={(e) => setFormEmpleado((prev) => ({ ...prev, fechaIngreso: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Categoría (opcional)</label>
              <input
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={formEmpleado.categoria}
                onChange={(e) => setFormEmpleado((prev) => ({ ...prev, categoria: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              disabled={guardandoEmpleado}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {guardandoEmpleado ? 'Creando…' : 'Crear empleado'}
            </button>
            <button type="button" onClick={() => setMostrarFormEmpleado(false)} className="text-sm text-slate-500 hover:underline">
              Cancelar
            </button>
            {errorEmpleado && <p className="w-full text-xs text-red-600">{errorEmpleado}</p>}
          </form>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">CUIL</th>
                <th className="px-4 py-2 font-medium">Fecha de ingreso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {empleados.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2">{e.nombre}</td>
                  <td className="px-4 py-2 font-mono text-xs">{e.cuil}</td>
                  <td className="px-4 py-2">{new Date(e.fechaIngreso).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                </tr>
              ))}
              {empleados.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Sin empleados cargados todavía — creá uno o importá la nómina.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Nuevo caso individual</h2>
          {!mostrarFormCaso && (
            <button
              onClick={() => setMostrarFormCaso(true)}
              disabled={empleados.length === 0}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              title={empleados.length === 0 ? 'Primero cargá al menos un empleado' : undefined}
            >
              Nuevo caso
            </button>
          )}
        </div>

        {mostrarFormCaso && (
          <form onSubmit={crearCaso} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4">
            <div>
              <label className="block text-xs text-slate-500">Empleado</label>
              <select
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={formCaso.empleadoId}
                onChange={(e) => setFormCaso((prev) => ({ ...prev, empleadoId: e.target.value }))}
              >
                <option value="">Elegir…</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre} ({e.cuil})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500">Tipo de extinción</label>
              <select
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={formCaso.tipoExtincion}
                onChange={(e) => setFormCaso((prev) => ({ ...prev, tipoExtincion: e.target.value }))}
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
                value={formCaso.fechaExtincion}
                onChange={(e) => setFormCaso((prev) => ({ ...prev, fechaExtincion: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              disabled={guardandoCaso}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {guardandoCaso ? 'Creando…' : 'Crear caso'}
            </button>
            <button type="button" onClick={() => setMostrarFormCaso(false)} className="text-sm text-slate-500 hover:underline">
              Cancelar
            </button>
            {errorCaso && <p className="w-full text-xs text-red-600">{errorCaso}</p>}
          </form>
        )}
      </section>
    </div>
  );
}
