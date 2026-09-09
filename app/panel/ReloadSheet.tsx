'use client'

import { useState } from 'react'
import { Loader2, RefreshCcw, Table2 } from 'lucide-react'
import { api, ApiError, errorMessage } from '@/lib/api'

// La hoja se mantiene sola con cada encuesta; esta recarga la deja idéntica a la
// base cuando alguien editó o borró filas por su cuenta.
export function ReloadSheet({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [reloading, setReloading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function reload() {
    if (reloading) return
    setReloading(true)
    setMessage('')
    setError('')
    try {
      const { rows } = await api<{ rows: number }>('admin.sheet.reload', { body: {} })
      setMessage(`La hoja quedó con ${rows} ${rows === 1 ? 'registro' : 'registros'}.`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired()
      else setError(errorMessage(error))
    } finally { setReloading(false) }
  }

  return <div className="border-b border-slate-800 px-4 py-4 lg:px-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-lg text-xs leading-5 text-slate-400">Reescribe la hoja de cálculo de Google con todos los registros actuales. Útil si se editaron o borraron filas a mano.</p>
      <button type="button" className="panel-secondary" disabled={reloading} onClick={reload}>
        {reloading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Table2 size={16} aria-hidden="true" />}
        {reloading ? 'Actualizando hoja…' : 'Recargar hoja'}
        {!reloading && <RefreshCcw size={13} aria-hidden="true" />}
      </button>
    </div>
    <p role="status" className="text-xs text-emerald-300">{message && <span className="mt-3 block">{message}</span>}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
  </div>
}
