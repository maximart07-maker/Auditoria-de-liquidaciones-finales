'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ItemMenu {
  etiqueta: string;
  href?: string;
  /** Rutas (además de href) que marcan el ítem como activo. */
  activoSi?: (ruta: string) => boolean;
  proximamente?: boolean;
  /** Muestra la marca "Pendiente" (dato del cliente todavía sin cargar). */
  pendiente?: boolean;
}

/** Menú lateral del cliente: datos compartidos del cliente y módulos de auditoría. */
export function MenuCliente({
  clienteId,
  razonSocial,
  cargasSocialesPendientes = false,
}: {
  clienteId: string;
  razonSocial: string;
  cargasSocialesPendientes?: boolean;
}) {
  const ruta = usePathname();
  const base = `/clientes/${clienteId}`;

  const secciones: { titulo: string; items: ItemMenu[] }[] = [
    {
      titulo: 'Módulos',
      items: [
        { etiqueta: 'Liquidaciones finales', href: base, activoSi: (r) => r === base },
        { etiqueta: 'Nómina mensual', proximamente: true },
      ],
    },
    {
      titulo: 'Datos del cliente',
      items: [
        { etiqueta: 'Importar nómina', href: `${base}/importar` },
        { etiqueta: 'Conceptos fijos y variables', href: `${base}/configuracion` },
        { etiqueta: 'Cargas sociales', href: `${base}/cargas-sociales`, pendiente: cargasSocialesPendientes },
      ],
    },
  ];

  return (
    <nav aria-label="Menú del cliente" className="space-y-5 text-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Cliente</p>
        <p className="font-semibold text-crowe-indigo">{razonSocial}</p>
      </div>
      {secciones.map((seccion) => (
        <div key={seccion.titulo} className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{seccion.titulo}</p>
          <ul className="space-y-0.5">
            {seccion.items.map((item) => {
              if (item.proximamente || !item.href) {
                return (
                  <li key={item.etiqueta}>
                    <span className="flex items-center justify-between gap-2 rounded px-3 py-1.5 text-slate-400">
                      {item.etiqueta}
                      <span className="rounded-full bg-crowe-ambar/15 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-800">
                        Próximamente
                      </span>
                    </span>
                  </li>
                );
              }
              const activo = item.activoSi ? item.activoSi(ruta) : ruta.startsWith(item.href);
              return (
                <li key={item.etiqueta}>
                  <Link
                    href={item.href}
                    aria-current={activo ? 'page' : undefined}
                    className={`flex items-center justify-between gap-2 rounded border-l-4 px-3 py-1.5 font-medium ${
                      activo
                        ? 'border-crowe-magenta bg-white text-crowe-indigo shadow-sm'
                        : 'border-transparent text-slate-600 hover:bg-white hover:text-crowe-indigo'
                    }`}
                  >
                    {item.etiqueta}
                    {item.pendiente && (
                      <span className="rounded-full bg-crowe-ambar/15 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-800">
                        Pendiente
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
