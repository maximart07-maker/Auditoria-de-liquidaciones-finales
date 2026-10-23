'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Menú de las pantallas de un cliente. `cargasSociales` = null si la API no respondió. */
export function MenuCliente({ clienteId, cargasSocialesConfiguradas }: { clienteId: string; cargasSocialesConfiguradas: boolean | null }) {
  const pathname = usePathname();
  const base = `/clientes/${clienteId}`;
  const opciones = [
    { href: base, etiqueta: 'Casos y empleados' },
    { href: `${base}/cargas-sociales`, etiqueta: 'Cargas sociales', pendiente: cargasSocialesConfiguradas !== true },
    { href: `${base}/configuracion`, etiqueta: 'Conceptos fijos y variables' },
    { href: `${base}/importar`, etiqueta: 'Importar' },
  ];

  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-200">
      {opciones.map((o) => {
        const activa = pathname === o.href;
        return (
          <Link
            key={o.href}
            href={o.href}
            aria-current={activa ? 'page' : undefined}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
              activa ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {o.etiqueta}
            {o.pendiente && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                pendiente
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
