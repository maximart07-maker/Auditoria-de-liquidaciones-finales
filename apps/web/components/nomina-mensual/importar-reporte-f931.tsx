'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ResultadoImportacionReporteF931, apiClient } from '@/lib/api-client';

const TEXTOS = {
  reporte: {
    titulo: 'Reporte del sistema de liquidación',
    ayuda:
      'CSV con ";": un renglón por empleado con Período, CUIL, Contrato, Remuneración Total, Remuneración 1 a 10 y montos a detraer.',
    boton: 'Importar reporte',
  },
  ddjj: {
    titulo: 'Nómina de Declaración en Línea',
    ayuda: 'El CSV que se descarga de Declaración en Línea (F.931 presentado). Se cruza por CUIL con el reporte del mismo período.',
    boton: 'Importar nómina DDJJ',
  },
} as const;

/** Importa el reporte del sistema de liquidación o la nómina de Declaración en Línea (CSV con ";"). */
export function ImportarReporteF931({ clienteId, tipo }: { clienteId: string; tipo: keyof typeof TEXTOS }) {
  const router = useRouter();
  const textos = TEXTOS[tipo];
  const [archivo, setArchivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacionReporteF931 | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importar(evento: FormEvent) {
    evento.preventDefault();
    if (!archivo) {
      setError('Elegí primero el archivo .csv a importar.');
      return;
    }
    setImportando(true);
    setError(null);
    setResultado(null);
    try {
      const r =
        tipo === 'reporte'
          ? await apiClient.importarReporteF931(clienteId, archivo)
          : await apiClient.importarNominaDDJJ(clienteId, archivo);
      setResultado(r);
      const ultimo = r.periodos[r.periodos.length - 1];
      if (ultimo) router.push(`/clientes/${clienteId}/nomina-mensual/control-de-leyes?periodo=${ultimo.periodo}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImportando(false);
    }
  }

  const mensajes = resultado ? [...resultado.errores, ...resultado.advertencias] : [];

  return (
    <div className="space-y-3">
      <form onSubmit={importar} className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-white p-4">
        <p className="text-sm font-medium text-crowe-indigo">{textos.titulo}</p>
        <p className="text-xs text-slate-400">{textos.ayuda} Si el período ya estaba importado, se reemplaza.</p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,.txt"
            aria-label={textos.titulo}
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="min-w-0 max-w-full flex-1 text-sm"
          />
          <button type="submit" disabled={importando} className="btn-primario">
            {importando ? 'Importando…' : textos.boton}
          </button>
        </div>
      </form>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {resultado && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {resultado.periodos
            .map(
              (p) =>
                `${p.periodo}: ${p.cantidadEmpleados} empleados importados${p.reemplazado ? ' (reemplazó la importación anterior)' : ''}`,
            )
            .join(' · ')}
          {mensajes.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
              {mensajes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
