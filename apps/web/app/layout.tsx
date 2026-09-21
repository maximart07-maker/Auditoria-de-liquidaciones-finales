import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Auditoría de Liquidaciones Finales',
  description: 'Control, comparación y auditoría de liquidaciones finales de sueldos.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="border-b border-slate-200 bg-white px-6 py-3">
          <span className="font-semibold">Auditoría de Liquidaciones Finales</span>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
