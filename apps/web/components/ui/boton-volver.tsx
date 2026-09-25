import Link from 'next/link';

export function BotonVolver({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      <span aria-hidden>←</span> {children}
    </Link>
  );
}
