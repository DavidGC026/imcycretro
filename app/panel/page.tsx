import type { Metadata } from 'next'
import { AdminPanel } from './AdminPanel'

export const metadata: Metadata = {
  title: 'Panel de administración | IMCYC',
  robots: { index: false, follow: false },
}

export default function PanelPage() {
  return <AdminPanel />
}
