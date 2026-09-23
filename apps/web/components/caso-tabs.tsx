'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CasoDetalle, apiClient } from '@/lib/api-client';
import { EstadoBadge } from './ui/estado-badge';
import { SeveridadBadge } from './ui/severidad-badge';
import { RemuneracionesMensuales } from './remuneraciones-mensuales';
import { VariablesCasoForm } from './variables-caso-form';
import { LiquidacionEmpresaForm } from './liquidacion-empresa-form';

const TABS = [
  'Datos base',
  'Remuneraciones',
  'Documentos',
  'Variables',
  'Liquidación empresa',
  'Auditoría',
  'Informe',
] as const;
type Tab = (typeof TABS)[number];

/** Ficha de caso con navegación por tabs — ver docs/flujo-ux.md §2 "Paso 4". */
export function CasoTabs({ caso }: { caso: CasoDetalle }) {
  const router = useRouter();
  const [tabActiva, setTabActiva] = useState<Tab>('Datos base');
  const [ejecutando, setEjecutando] = useState(false);
  const [errorAuditoria, setErrorAuditoria] = useState<string | null>(null);
  const ultimaAuditoria = caso.auditorias[0];
  const liquidacionEmpresa = caso.liquidaciones.find((l) => l.origen === 'empresa');

  async function ejecutarAuditoria() {
    setErrorAuditoria(null);
    setEjecutando(true);
    try {
      await apiClient.ejecutarAuditoria(caso.id);
      router.refresh();
    } catch (e) {
      setErrorAuditoria((e as Error).message);
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setTabActiva(tab)}
            className={`px-3 py-2 text-sm font-medium ${
              tabActiva === tab
                ? 'border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {tabActiva === 'Datos base' && (
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-slate-500">Empleado:</span> {caso.empleado.nombre} ({caso.empleado.cuil})
          </p>
          <p>
            <span className="text-slate-500">Tipo de extinción:</span> {caso.tipoExtincion.replaceAll('_', ' ')}
          </p>
          <p>
            <span className="text-slate-500">Fecha de extinción:</span>{' '}
            {new Date(caso.fechaExtincion).toLocaleDateString('es-AR')}
          </p>
          <p>
            <span className="text-slate-500">Estado:</span> <EstadoBadge estado={caso.estado} />
          </p>
        </div>
      )}

      {tabActiva === 'Remuneraciones' && (
        <RemuneracionesMensuales empleadoId={caso.empleado.id} inicial={caso.empleado.remuneracionesMensuales ?? []} />
      )}

      {tabActiva === 'Documentos' && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
          {caso.documentos.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between px-4 py-2">
              <span>{doc.tipo.replaceAll('_', ' ')}</span>
              <span className="text-xs text-slate-500">{doc.estadoProcesamiento}</span>
            </li>
          ))}
          {caso.documentos.length === 0 && <li className="px-4 py-6 text-center text-slate-400">Sin documentos cargados.</li>}
        </ul>
      )}

      {tabActiva === 'Variables' && <VariablesCasoForm casoId={caso.id} variables={caso.variables} />}

      {tabActiva === 'Liquidación empresa' && (
        <LiquidacionEmpresaForm casoId={caso.id} rubrosDeclarados={liquidacionEmpresa?.rubros ?? []} />
      )}

      {tabActiva === 'Auditoría' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={ejecutarAuditoria}
              disabled={ejecutando}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {ejecutando ? 'Ejecutando…' : 'Ejecutar auditoría'}
            </button>
            {errorAuditoria && <p className="text-xs text-red-600">{errorAuditoria}</p>}
          </div>
          {!ultimaAuditoria && <p className="text-sm text-slate-400">Todavía no se ejecutó ninguna auditoría.</p>}
          {ultimaAuditoria && (
            <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Rubro</th>
                  <th className="px-4 py-2 font-medium">Declarado</th>
                  <th className="px-4 py-2 font-medium">Calculado</th>
                  <th className="px-4 py-2 font-medium">Diferencia %</th>
                  <th className="px-4 py-2 font-medium">Severidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ultimaAuditoria.hallazgos.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2">{h.rubro.nombre}</td>
                    <td className="px-4 py-2">${Number(h.montoDeclarado).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-2">${Number(h.montoCalculado).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-2">{h.porcentajeDiferencia ? `${Number(h.porcentajeDiferencia).toFixed(1)}%` : '—'}</td>
                    <td className="px-4 py-2">
                      <SeveridadBadge severidad={h.severidad} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tabActiva === 'Informe' && (
        <p className="text-sm text-slate-500">
          {caso.estado === 'cerrado' || caso.estado === 'auditado'
            ? 'El informe PDF estará disponible acá una vez integrada la generación (Puppeteer/WeasyPrint, ver docs/arquitectura.md).'
            : 'El informe se habilita cuando el caso está auditado o cerrado.'}
        </p>
      )}
    </div>
  );
}
