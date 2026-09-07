import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Comunidad IMCYC | Identificación',
  description: 'Acceso a la iniciativa Comunidad IMCYC: aprender, aplicar y compartir.',
  generator: 'IMCYC',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0f17',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es" className="bg-background"><body className="antialiased">{children}</body></html>
}
