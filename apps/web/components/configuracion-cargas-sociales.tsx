'use client';

import { FormEvent, ReactNode, useState } from 'react';
import {
  CargasSocialesCliente,
  ConfiguracionCargasSociales as Configuracion,
  RegimenDetraccion,
  RegimenDiferencialSUSS,
  ResultadoCargasSociales,
  TipoEmpleadorSUSS,
  apiClient,
} from '@/lib/api-client';

/** Configuración de cargas sociales del cliente y simulador de costo laboral —
 * ver docs/motor-calculo.md §10. Los rangos los valida el backend con
 * `validarConfiguracionCargasSociales` (motor-calculo); acá solo se guían. */

const TIPOS_EMPLEADOR: { valor: TipoEmpleadorSUSS; etiqueta: string; detalle: string }[] = [
  {
    valor: 'pyme',
    etiqueta: 'PyME / Sin fines de lucro / Sector público / Agro / Construcción',
    detalle: 'SUSS 18,00% · Obra social 6,00% · FAL 2,50%',
  },
  {
    valor: 'gran_empresa',
    etiqueta: 'Gran empresa (comercio / servicios sobre límites PyME)',
    detalle: 'SUSS 20,40% · Obra social 6,00% · FAL 1,00%',
  },
];

const REGIMENES: { valor: RegimenDiferencialSUSS; etiqueta: string; rango: [number, number] }[] = [
  { valor: 'comun', etiqueta: 'Actividad común (sin régimen diferencial)', rango: [0, 0] },
  { valor: 'choferes', etiqueta: 'Choferes de transporte de carga / pasajeros', rango: [2, 5] },
  { valor: 'construccion', etiqueta: 'Construcción (UOCRA — Ley 22.250 / Dec. 1021/74)', rango: [2, 5] },
  { valor: 'docentes', etiqueta: 'Docentes nacionales / universitarios', rango: [2, 2] },
  { valor: 'insalubres', etiqueta: 'Carne / Minería / Petroleros / Tareas insalubres', rango: [2, 5] },
  { valor: 'manual', etiqueta: 'Alícuota diferencial manual', rango: [0, 100] },
];

const DETRACCIONES: { valor: RegimenDetraccion; etiqueta: string }[] = [
  { valor: 'general', etiqueta: 'Régimen general (art. 22 Ley 27.541) — $7.003,68' },
  { valor: 'incrementado', etiqueta: 'Régimen incrementado / especial (art. 23 Ley 27.541) — $17.509,20' },
  { valor: 'sin_detraccion', etiqueta: 'Sin detracción' },
];

const CONCEPTOS: Record<string, string> = {
  SUSS: 'Contribuciones SUSS',
  OBRA_SOCIAL: 'Obra social',
  FAL: 'FAL',
  ART: 'ART (variable + FFEP)',
  SCVO: 'SCVO',
};

const pesos = (n: number) => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const aTexto = (n: number | null) => (n === null ? '' : String(n));
/** Acepta formato argentino ("1.500.000,50", "1.500.000", "2,5") o punto decimal ("2.5"). */
function aNumero(s: string): number {
  const t = s.trim().replace(/\s|\$/g, '');
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t);
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
      <legend className="px-1 text-sm font-semibold text-slate-700">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500">{etiqueta}</label>
      {children}
    </div>
  );
}

const claseInput = 'w-36 rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100';

export function ConfiguracionCargasSociales({ clienteId, inicial }: { clienteId: string; inicial: CargasSocialesCliente }) {
  const c = inicial.configuracion;
  const [configurado, setConfigurado] = useState(inicial.configurado);
  const [form, setForm] = useState({
    tipoEmpleador: c.tipoEmpleador,
    regimenDiferencial: c.regimenDiferencial,
    adicional: aTexto(c.adicionalDiferencialPorcentaje),
    aplicaFAL: c.aplicaFAL,
    artPorcentaje: aTexto(c.artPorcentaje),
    artCuotaFija: aTexto(c.artCuotaFija),
    scvo: aTexto(c.scvoPorEmpleado),
    regimenDetraccion: c.regimenDetraccion,
    montoDetraccion: aTexto(c.montoDetraccionPersonalizado),
    jornadaParcial: c.horasSemanalesJornadaParcial !== null,
    horas: aTexto(c.horasSemanalesJornadaParcial),
  });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const [simulacion, setSimulacion] = useState({ sueldoBruto: '', cantidadEmpleados: '1', incluyeSAC: false });
  const [resultado, setResultado] = useState<ResultadoCargasSociales | null>(null);
  const [errorCalculo, setErrorCalculo] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  const regimen = REGIMENES.find((r) => r.valor === form.regimenDiferencial)!;
  const adicionalFijo = regimen.rango[0] === regimen.rango[1];
  const set = <K extends keyof typeof form>(clave: K, valor: (typeof form)[K]) => setForm((prev) => ({ ...prev, [clave]: valor }));

  function elegirRegimen(valor: RegimenDiferencialSUSS) {
    const r = REGIMENES.find((x) => x.valor === valor)!;
    setForm((prev) => ({ ...prev, regimenDiferencial: valor, adicional: String(r.rango[0]) }));
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setMensaje(null);
    const dto: Configuracion = {
      tipoEmpleador: form.tipoEmpleador,
      regimenDiferencial: form.regimenDiferencial,
      adicionalDiferencialPorcentaje: aNumero(form.adicional || '0'),
      aplicaFAL: form.aplicaFAL,
      artPorcentaje: aNumero(form.artPorcentaje || '0'),
      artCuotaFija: aNumero(form.artCuotaFija || '0'),
      scvoPorEmpleado: aNumero(form.scvo || '0'),
      regimenDetraccion: form.regimenDetraccion,
      montoDetraccionPersonalizado:
        form.regimenDetraccion !== 'sin_detraccion' && form.montoDetraccion.trim() ? aNumero(form.montoDetraccion) : null,
      horasSemanalesJornadaParcial: form.jornadaParcial ? aNumero(form.horas) : null,
    };
    const invalido = Object.entries(dto).find(([, v]) => typeof v === 'number' && Number.isNaN(v));
    if (invalido) {
      setMensaje({ tipo: 'error', texto: 'Revisá los valores numéricos: hay un campo con un número inválido.' });
      return;
    }
    setGuardando(true);
    try {
      await apiClient.guardarCargasSociales(clienteId, dto);
      setConfigurado(true);
      setResultado(null);
      setMensaje({ tipo: 'ok', texto: 'Configuración guardada.' });
    } catch (error) {
      setMensaje({ tipo: 'error', texto: (error as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  async function calcular(evento: FormEvent) {
    evento.preventDefault();
    setErrorCalculo(null);
    const sueldoBruto = aNumero(simulacion.sueldoBruto);
    const cantidadEmpleados = Number(simulacion.cantidadEmpleados);
    if (Number.isNaN(sueldoBruto) || !Number.isInteger(cantidadEmpleados) || cantidadEmpleados < 1) {
      setErrorCalculo('Ingresá un sueldo bruto válido y una cantidad de empleados entera mayor a 0.');
      return;
    }
    setCalculando(true);
    try {
      setResultado(await apiClient.calcularCargasSociales(clienteId, { sueldoBruto, cantidadEmpleados, incluyeSAC: simulacion.incluyeSAC }));
    } catch (error) {
      setErrorCalculo((error as Error).message);
    } finally {
      setCalculando(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={guardar} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Parámetros del cliente</h2>
          {!configurado && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Sin configurar</span>
          )}
        </div>

        <Seccion titulo="1. Tipo de empleador">
          {TIPOS_EMPLEADOR.map((t) => (
            <label key={t.valor} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                className="mt-1"
                checked={form.tipoEmpleador === t.valor}
                onChange={() => set('tipoEmpleador', t.valor)}
              />
              <span>
                {t.etiqueta}
                <span className="block text-xs text-slate-500">{t.detalle}</span>
              </span>
            </label>
          ))}
        </Seccion>

        <Seccion titulo="2. Actividad / régimen diferencial">
          {REGIMENES.map((r) => (
            <label key={r.valor} className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.regimenDiferencial === r.valor} onChange={() => elegirRegimen(r.valor)} />
              {r.etiqueta}
              <span className="text-xs text-slate-400">
                {r.rango[0] === r.rango[1] ? `+${r.rango[0]}%` : r.valor === 'manual' ? 'libre' : `+${r.rango[0]}% a +${r.rango[1]}%`}
              </span>
            </label>
          ))}
          <Campo etiqueta="% adicional de contribución patronal al SIPA">
            <input
              className={claseInput}
              value={form.adicional}
              disabled={adicionalFijo}
              onChange={(e) => set('adicional', e.target.value)}
            />
          </Campo>
        </Seccion>

        <Seccion titulo="3. Fondo de Asistencia Laboral (FAL)">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.aplicaFAL} onChange={(e) => set('aplicaFAL', e.target.checked)} />
            Aplica FAL ({form.tipoEmpleador === 'pyme' ? '2,50%' : '1,00%'} sobre el sueldo bruto)
          </label>
        </Seccion>

        <Seccion titulo="4. ART y seguros (por empleado)">
          <div className="flex flex-wrap gap-4">
            <Campo etiqueta="% variable ART">
              <input className={claseInput} placeholder="2,5" value={form.artPorcentaje} onChange={(e) => set('artPorcentaje', e.target.value)} />
            </Campo>
            <Campo etiqueta="Cuota fija ART (FFEP) $">
              <input className={claseInput} value={form.artCuotaFija} onChange={(e) => set('artCuotaFija', e.target.value)} />
            </Campo>
            <Campo etiqueta="SCVO por empleado $">
              <input className={claseInput} value={form.scvo} onChange={(e) => set('scvo', e.target.value)} />
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="5. Detracción y jornada">
          {DETRACCIONES.map((d) => (
            <label key={d.valor} className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.regimenDetraccion === d.valor} onChange={() => set('regimenDetraccion', d.valor)} />
              {d.etiqueta}
            </label>
          ))}
          <Campo etiqueta="Monto de detracción actualizado $ (vacío = valor de la ley)">
            <input
              className={claseInput}
              value={form.montoDetraccion}
              disabled={form.regimenDetraccion === 'sin_detraccion'}
              onChange={(e) => set('montoDetraccion', e.target.value)}
            />
          </Campo>
          <div className="flex flex-wrap items-end gap-4 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!form.jornadaParcial} onChange={() => set('jornadaParcial', false)} />
              Jornada completa (48 hs)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={form.jornadaParcial} onChange={() => set('jornadaParcial', true)} />
              Jornada parcial (art. 92 ter LCT)
            </label>
            {form.jornadaParcial && (
              <Campo etiqueta="Horas semanales">
                <input className={claseInput} placeholder="24" value={form.horas} onChange={(e) => set('horas', e.target.value)} />
              </Campo>
            )}
          </div>
        </Seccion>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={guardando}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar configuración'}
          </button>
          {mensaje && (
            <p className={`text-sm ${mensaje.tipo === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{mensaje.texto}</p>
          )}
        </div>
      </form>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">6. Calcular costo laboral</h2>
        <form onSubmit={calcular} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4">
          <Campo etiqueta="Sueldo bruto remunerativo por empleado $">
            <input
              className={claseInput}
              placeholder="1500000"
              value={simulacion.sueldoBruto}
              onChange={(e) => setSimulacion((p) => ({ ...p, sueldoBruto: e.target.value }))}
            />
          </Campo>
          <Campo etiqueta="Cantidad de empleados">
            <input
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
              value={simulacion.cantidadEmpleados}
              onChange={(e) => setSimulacion((p) => ({ ...p, cantidadEmpleados: e.target.value }))}
            />
          </Campo>
          <label className="flex items-center gap-2 pb-1 text-sm">
            <input
              type="checkbox"
              checked={simulacion.incluyeSAC}
              onChange={(e) => setSimulacion((p) => ({ ...p, incluyeSAC: e.target.checked }))}
            />
            Incluye SAC proporcional
          </label>
          <button
            type="submit"
            disabled={calculando || !configurado}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {calculando ? 'Calculando…' : 'Calcular'}
          </button>
          {!configurado && <p className="w-full text-xs text-slate-500">Guardá la configuración del cliente para poder calcular.</p>}
          {errorCalculo && <p className="w-full text-xs text-red-600">{errorCalculo}</p>}
        </form>

        {resultado && <ResultadoCalculo resultado={resultado} cantidadEmpleados={Number(simulacion.cantidadEmpleados)} />}
      </section>
    </div>
  );
}

function ResultadoCalculo({ resultado, cantidadEmpleados }: { resultado: ResultadoCargasSociales; cantidadEmpleados: number }) {
  const { resumen, lineas, totales } = resultado;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h3 className="mb-2 font-semibold">Resumen de configuración</h3>
        <ul className="grid gap-1 text-slate-600 sm:grid-cols-2">
          <li>
            Alícuota SUSS: {pct(resumen.alicuotaSUSSBase)} + {pct(resumen.adicionalDiferencial)} ={' '}
            <strong>{pct(resumen.alicuotaSUSSTotal)}</strong>
          </li>
          <li>
            Jornada: {resumen.horasSemanales} hs semanales (factor {resumen.factorJornada.toLocaleString('es-AR', { maximumFractionDigits: 4 })})
          </li>
          <li>
            Detracción: {pesos(resumen.montoDetraccionBase)} base → <strong>{pesos(resumen.montoDetraccionAplicado)}</strong> aplicada
          </li>
          <li>FAL: {pct(resumen.alicuotaFAL)}</li>
        </ul>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Concepto</th>
              <th className="px-4 py-2 text-right font-medium">Base imponible</th>
              <th className="px-4 py-2 text-right font-medium">Alícuota / fijo</th>
              <th className="px-4 py-2 text-right font-medium">Importe por empleado</th>
              {cantidadEmpleados > 1 && <th className="px-4 py-2 text-right font-medium">Importe total ({cantidadEmpleados})</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lineas.map((l) => (
              <tr key={l.concepto}>
                <td className="px-4 py-2">{CONCEPTOS[l.concepto] ?? l.descripcion}</td>
                <td className="px-4 py-2 text-right">{l.baseImponible === null ? '—' : pesos(l.baseImponible)}</td>
                <td className="px-4 py-2 text-right">
                  {[l.alicuota !== null ? pct(l.alicuota) : null, l.fijo ? `${pesos(l.fijo)} fijo` : null].filter(Boolean).join(' + ') || '—'}
                </td>
                <td className="px-4 py-2 text-right">{pesos(l.importePorEmpleado)}</td>
                {cantidadEmpleados > 1 && <td className="px-4 py-2 text-right">{pesos(l.importeTotal)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Total sueldo bruto', pesos(totales.sueldoBrutoTotal)],
          ['Total cargas patronales y seguros', pesos(totales.cargasTotal)],
          ['Costo laboral total', pesos(totales.costoLaboralTotal)],
          ['Sobrecosto patronal', pct(totales.sobrecostoPorcentaje)],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{etiqueta}</p>
            <p className="text-lg font-semibold">{valor}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
