import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Auditoría Control de Nómina',
  description: 'Control y auditoría de nómina y liquidaciones de sueldos bajo legislación argentina.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="bg-gradient-to-r from-crowe-indigo via-crowe-indigo to-crowe-ciruela text-white">
          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <Link href="/" className="font-semibold hover:text-crowe-ambar-claro">
              Auditoría Control de Nómina
            </Link>
            <nav aria-label="Menú principal" className="text-sm">
              <Link href="/" className="rounded px-3 py-1.5 font-medium text-white/90 hover:bg-white/10 hover:text-white">
                Clientes
              </Link>
            </nav>
          </div>
          <div className="h-1 bg-crowe-franja" aria-hidden="true" />
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
