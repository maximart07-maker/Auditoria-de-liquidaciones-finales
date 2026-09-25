const ESTILOS: Record<string, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-emerald-100 text-emerald-700',
};

export function SeveridadBadge({ severidad }: { severidad: 'alta' | 'media' | 'baja' | null }) {
  if (!severidad) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTILOS[severidad]}`}>{severidad}</span>
  );
}
