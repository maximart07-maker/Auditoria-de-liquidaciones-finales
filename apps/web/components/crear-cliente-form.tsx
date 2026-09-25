'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

export function CrearClienteForm() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ razonSocial: '', cuit: '', industria: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    if (!form.razonSocial.trim() || !form.cuit.trim()) {
      setError('Completá razón social y CUIT.');
      return;
    }
    setGuardando(true);
    try {
      const cliente = await apiClient.crearCliente({
        razonSocial: form.razonSocial.trim(),
        cuit: form.cuit.trim(),
        industria: form.industria.trim() || undefined,
      });
      router.push(`/clientes/${cliente.id}`);
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Nuevo cliente
      </button>
    );
  }

  return (
    <form onSubmit={crear} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 p-4">
      <div>
        <label className="block text-xs text-slate-500">Razón social</label>
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          value={form.razonSocial}
          onChange={(e) => setForm((prev) => ({ ...prev, razonSocial: e.target.value }))}
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">CUIT</label>
        <input
          className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="30712345671"
          value={form.cuit}
          onChange={(e) => setForm((prev) => ({ ...prev, cuit: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Industria (opcional)</label>
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          value={form.industria}
          onChange={(e) => setForm((prev) => ({ ...prev, industria: e.target.value }))}
        />
      </div>
      <button
        type="submit"
        disabled={guardando}
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {guardando ? 'Creando…' : 'Crear cliente'}
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="text-sm text-slate-500 hover:underline">
        Cancelar
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
