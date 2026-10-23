const ESTILOS: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  en_revision: 'bg-amber-100 text-amber-700',
  auditado: 'bg-blue-100 text-blue-700',
  cerrado: 'bg-emerald-100 text-emerald-700',
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTILOS[estado] ?? 'bg-slate-100 text-slate-600'}`}>
      {estado.replaceAll('_', ' ')}
    </span>
  );
}
