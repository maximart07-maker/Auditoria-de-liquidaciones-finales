'use client';

import { useState } from 'react';
import { CasoDetalle } from '@/lib/api-client';
import { EstadoBadge } from './ui/estado-badge';
import { SeveridadBadge } from './ui/severidad-badge';
import { RemuneracionesMensuales } from './remuneraciones-mensuales';

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
  const [tabActiva, setTabActiva] = useState<Tab>('Datos base');
  const ultimaAuditoria = caso.auditorias[0];
  const liquidacionEmpresa = caso.liquidaciones.find((l) => l.origen === 'empresa');

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
        <RemuneracionesMensuales casoId={caso.id} inicial={caso.remuneracionesMensuales} />
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

      {tabActiva === 'Variables' && (
        <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Clave</th>
              <th className="px-4 py-2 font-medium">Valor</th>
              <th className="px-4 py-2 font-medium">Fuente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {caso.variables.map((v) => (
              <tr key={v.id} className={v.fuente === 'ocr' && Number(v.confianza) < 0.75 ? 'bg-amber-50' : ''}>
                <td className="px-4 py-2 font-mono text-xs">{v.clave}</td>
                <td className="px-4 py-2">{v.valor}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{v.fuente}</td>
              </tr>
            ))}
            {caso.variables.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                  Sin variables cargadas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {tabActiva === 'Liquidación empresa' && (
        <TablaRubros titulo="Declarado por la empresa" rubros={liquidacionEmpresa?.rubros ?? []} />
      )}

      {tabActiva === 'Auditoría' && (
        <div className="space-y-3">
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

function TablaRubros({ titulo, rubros }: { titulo: string; rubros: { monto: string; rubro: { nombre: string } }[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-600">{titulo}</h3>
      <table className="w-full rounded-lg border border-slate-200 bg-white text-sm">
        <tbody className="divide-y divide-slate-100">
          {rubros.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2">{r.rubro.nombre}</td>
              <td className="px-4 py-2 text-right">${Number(r.monto).toLocaleString('es-AR')}</td>
            </tr>
          ))}
          {rubros.length === 0 && (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                Sin rubros cargados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
