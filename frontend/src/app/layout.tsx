import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sistema ERP - Colegio de Ingenieros',
  description: 'Sistema ERP Institucional - Colegio de Ingenieros del Perú',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = headers().get('x-nonce') ?? undefined;

  return (
    <html lang="es">
      <head>
        {nonce && <meta property="csp-nonce" content={nonce} />}
      </head>
      <body>{children}</body>
    </html>
  );
}
