'use client'

import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { ApiError, errorMessage } from '@/lib/api'
import { downloadRegistrations } from '@/lib/download-registrations'

export function ExportRegistrations({ query, disabled, onSessionExpired }: { query: string; disabled: boolean; onSessionExpired: () => void }) {
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  async function download() {
    if (request.current || disabled) return
    const controller = new AbortController()
    request.current = controller
    setExporting(true)
    setMessage('')
    setError('')
    try {
      const count = await downloadRegistrations(new URLSearchParams(query), controller.signal)
      if (count !== null) setMessage(`Se inició la descarga de ${count} ${count === 1 ? 'registro' : 'registros'}.`)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 401) onSessionExpired()
      else setError(errorMessage(error))
    } finally {
      request.current = null
      if (!controller.signal.aborted) setExporting(false)
    }
  }

  return <div className="border-b border-slate-800 px-4 py-4 lg:px-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-lg text-xs leading-5 text-slate-400">Descarga todos los registros que coinciden con los filtros aplicados, incluidas las demás páginas.</p>
      <button type="button" className="panel-secondary" disabled={disabled || exporting} onClick={download}>
        {exporting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet size={16} aria-hidden="true" />}
        {exporting ? 'Generando Excel…' : 'Exportar Excel'}
      </button>
    </div>
    <p role="status" className="text-xs text-emerald-300">{message && <span className="mt-3 block">{message}</span>}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
  </div>
}
