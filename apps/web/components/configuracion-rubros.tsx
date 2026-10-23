'use client';

import { FormEvent, useState } from 'react';
import { ConfiguracionRubro, apiClient } from '@/lib/api-client';

/** Panel de configuración de conceptos fijos y variables por cliente — ver
 * docs/motor-calculo.md §9. Los rubros legales (esLegal=true, p.ej. indemnización
 * por antigüedad, vacaciones no gozadas) no se pueden desactivar ni pasar a
 * "variable": el backend (ConfiguracionesRubroService) rechaza esos cambios
 * porque violarían la legislación laboral argentina. Solo admiten los
 * parámetros normativos propios habilitados por rubro (tope indemnizatorio
 * para IND_ANTIGUEDAD; días de vacaciones por tramo de antigüedad del
 * convenio colectivo aplicable, para VAC_NO_GOZADAS) — el motor de cálculo
 * sigue garantizando siempre el piso legal de cada uno (67% de la MRMNH,
 * doctrina "Vizzoti", y DIAS_VACACIONES_LCT respectivamente) sin importar lo
 * que se configure acá. */
export function ConfiguracionRubros({ clienteId, inicial }: { clienteId: string; inicial: ConfiguracionRubro[] }) {
  const [configuraciones, setConfiguraciones] = useState(inicial);
  const [errorPorRubro, setErrorPorRubro] = useState<Record<string, string>>({});
  const [guardandoRubro, setGuardandoRubro] = useState<string | null>(null);
  const [nuevoConcepto, setNuevoConcepto] = useState({ codigo: '', nombre: '', valorFijo: '' });
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null);

  async function guardarParametros(codigoRubro: string, parametros: Record<string, number>) {
    setGuardandoRubro(codigoRubro);
    setErrorPorRubro((prev) => ({ ...prev, [codigoRubro]: '' }));
    try {
      const actualizado = await apiClient.guardarConfiguracionRubro(clienteId, codigoRubro, {
        tipo: 'fijo',
        activo: true,
        parametros,
      });
      setConfiguraciones((prev) => prev.map((c) => (c.rubro.codigo === codigoRubro ? actualizado : c)));
    } catch (error) {
      setErrorPorRubro((prev) => ({ ...prev, [codigoRubro]: (error as Error).message }));
    } finally {
      setGuardandoRubro(null);
    }
  }

  async function agregarConceptoVariable(evento: FormEvent) {
    evento.preventDefault();
    setErrorNuevo(null);
    const codigo = nuevoConcepto.codigo.trim().toUpperCase().replaceAll(' ', '_');
    const valor = Number(nuevoConcepto.valorFijo);
    if (!codigo || !nuevoConcepto.nombre.trim() || Number.isNaN(valor)) {
      setErrorNuevo('Completá código, nombre y un valor numérico válido.');
      return;
    }
    setGuardandoRubro(codigo);
    try {
      const creado = await apiClient.guardarConfiguracionRubro(clienteId, codigo, {
        tipo: 'variable',
        activo: true,
        valorFijo: valor,
        nombre: nuevoConcepto.nombre.trim(),
        baseLegal: 'Concepto propio del cliente (sin base legal)',
      });
      setConfiguraciones((prev) => [...prev.filter((c) => c.rubro.codigo !== codigo), creado]);
      setNuevoConcepto({ codigo: '', nombre: '', valorFijo: '' });
    } catch (error) {
      setErrorNuevo((error as Error).message);
    } finally {
      setGuardandoRubro(null);
    }
  }

  const fijos = configuraciones.filter((c) => c.rubro.esLegal);
  const variables = configuraciones.filter((c) => !c.rubro.esLegal);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conceptos fijos (legislación laboral)</h2>
          <p className="text-xs text-slate-500">
            Establecidos por la LCT y leyes complementarias. No se pueden desactivar ni convertir en variables; el motor de
            cálculo siempre respeta el piso legal, incluso si se personaliza el tope indemnizatorio.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Concepto</th>
                <th className="px-4 py-2 font-medium">Base legal</th>
                <th className="px-4 py-2 font-medium">Parámetros propios (piso legal siempre garantizado)</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fijos.map((config) => (
                <FilaRubroFijo
                  key={config.rubro.codigo}
                  config={config}
                  guardando={guardandoRubro === config.rubro.codigo}
                  error={errorPorRubro[config.rubro.codigo]}
                  onGuardar={(parametros) => guardarParametros(config.rubro.codigo, parametros)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conceptos variables (negociados)</h2>
          <p className="text-xs text-slate-500">
            Premios, bonos y adicionales propios de este cliente, sin piso legal — se cargan y valen tal como se definen acá.
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Concepto</th>
                <th className="px-4 py-2 font-medium">Código</th>
                <th className="px-4 py-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {variables.map((config) => (
                <tr key={config.rubro.codigo}>
                  <td className="px-4 py-2">{config.rubro.nombre}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{config.rubro.codigo}</td>
                  <td className="px-4 py-2">{config.valorFijo ? `$ ${Number(config.valorFijo).toLocaleString('es-AR')}` : '—'}</td>
                </tr>
              ))}
              {variables.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                    Sin conceptos variables cargados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={agregarConceptoVariable} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-300 p-3">
          <div>
            <label className="block text-xs text-slate-500">Código</label>
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="PREMIO_PRESENTISMO"
              value={nuevoConcepto.codigo}
              onChange={(e) => setNuevoConcepto((prev) => ({ ...prev, codigo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Nombre</label>
            <input
              className="rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="Premio por presentismo"
              value={nuevoConcepto.nombre}
              onChange={(e) => setNuevoConcepto((prev) => ({ ...prev, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">Valor ($)</label>
            <input
              className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
              placeholder="25000"
              value={nuevoConcepto.valorFijo}
              onChange={(e) => setNuevoConcepto((prev) => ({ ...prev, valorFijo: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            disabled={guardandoRubro !== null}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Agregar concepto
          </button>
          {errorNuevo && <p className="w-full text-xs text-red-600">{errorNuevo}</p>}
        </form>
      </section>
    </div>
  );
}

/** Tramos de antigüedad de `DiasVacacionesPorAntiguedad` (motor-calculo) → clave de
 * `parametros.VAC_NO_GOZADAS` (ver ConfiguracionesRubroService.CLAVES_DIAS_VACACIONES)
 * + el piso legal de cada tramo (art. 150 LCT), solo para mostrarlo como referencia. */
const TRAMOS_DIAS_VACACIONES = [
  { clave: 'diasVacacionesHasta5Anios', etiqueta: 'hasta 5 años', pisoLegal: 14 },
  { clave: 'diasVacaciones5a10Anios', etiqueta: '5 a 10 años', pisoLegal: 21 },
  { clave: 'diasVacaciones10a20Anios', etiqueta: '10 a 20 años', pisoLegal: 28 },
  { clave: 'diasVacacionesMasDe20Anios', etiqueta: '+20 años', pisoLegal: 35 },
] as const;

function FilaRubroFijo({
  config,
  guardando,
  error,
  onGuardar,
}: {
  config: ConfiguracionRubro;
  guardando: boolean;
  error?: string;
  onGuardar: (parametros: Record<string, number>) => void;
}) {
  const [tope, setTope] = useState(config.parametros?.topeIndemnizatorio?.toString() ?? '');
  const [diasPorTramo, setDiasPorTramo] = useState<Record<string, string>>(
    Object.fromEntries(TRAMOS_DIAS_VACACIONES.map((t) => [t.clave, config.parametros?.[t.clave]?.toString() ?? ''])),
  );

  if (config.rubro.codigo === 'IND_ANTIGUEDAD') {
    return (
      <tr>
        <td className="px-4 py-2">
          {config.rubro.nombre}
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
            fijo
          </span>
        </td>
        <td className="px-4 py-2 text-slate-500">{config.rubro.baseLegal}</td>
        <td className="px-4 py-2">
          <label className="mr-1 text-xs text-slate-400">Tope indemnizatorio ($)</label>
          <input
            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
            placeholder="genérico"
            value={tope}
            onChange={(e) => setTope(e.target.value)}
          />
        </td>
        <td className="px-4 py-2">
          <button
            disabled={guardando}
            onClick={() => onGuardar({ topeIndemnizatorio: Number(tope) })}
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  if (config.rubro.codigo === 'VAC_NO_GOZADAS') {
    return (
      <tr>
        <td className="px-4 py-2 align-top">
          {config.rubro.nombre}
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
            fijo
          </span>
        </td>
        <td className="px-4 py-2 align-top text-slate-500">{config.rubro.baseLegal}</td>
        <td className="px-4 py-2 align-top">
          <p className="mb-1 text-xs text-slate-400">
            Días anuales por convenio colectivo, si otorga más que el piso legal (dejar vacío = piso legal)
          </p>
          <div className="flex flex-wrap gap-2">
            {TRAMOS_DIAS_VACACIONES.map((t) => (
              <div key={t.clave}>
                <label className="block text-[10px] text-slate-400">
                  {t.etiqueta} (LCT: {t.pisoLegal})
                </label>
                <input
                  className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder={String(t.pisoLegal)}
                  value={diasPorTramo[t.clave]}
                  onChange={(e) => setDiasPorTramo((prev) => ({ ...prev, [t.clave]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </td>
        <td className="px-4 py-2 align-top">
          <button
            disabled={guardando}
            onClick={() =>
              onGuardar(
                Object.fromEntries(
                  TRAMOS_DIAS_VACACIONES.filter((t) => diasPorTramo[t.clave] !== '').map((t) => [
                    t.clave,
                    Number(diasPorTramo[t.clave]),
                  ]),
                ),
              )
            }
            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2">
        {config.rubro.nombre}
        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-500">
          fijo
        </span>
      </td>
      <td className="px-4 py-2 text-slate-500">{config.rubro.baseLegal}</td>
      <td className="px-4 py-2">
        <span className="text-slate-400">No aplica</span>
      </td>
      <td className="px-4 py-2"></td>
    </tr>
  );
}
