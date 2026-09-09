'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Download, Trash2, X } from 'lucide-react'
import { api, ApiError, errorMessage } from '@/lib/api'
import { displayDate, type Registration } from '@/lib/registration'
import { OpinionConsent } from './OpinionConsent'

type Props = {
  registration: Registration
  onClose: () => void
  onDeleted: (notice: string) => void
  onSessionExpired: () => void
}

export function RegistrationDetail({ registration, onClose, onDeleted, onSessionExpired }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  async function download() {
    if (!registration.unique_code || !registration.completed_at) return
    setDownloading(true)
    setError('')
    try {
      const { downloadKit } = await import('@/lib/download-kit')
      await downloadKit({ name: registration.full_name, company: registration.company, service: registration.service!, code: registration.unique_code, issuedAt: registration.completed_at })
    } catch (error) { setError(errorMessage(error)) }
    finally { setDownloading(false) }
  }

  async function remove() {
    if (deleting) return
    setDeleting(true)
    setError('')
    try {
      const result = await api<{ name: string; sheetUpdated: boolean }>('admin.registrations.delete', { body: { id: registration.id } })
      onDeleted(result.sheetUpdated
        ? `Se eliminó el registro de ${result.name}.`
        : `Se eliminó el registro de ${result.name}, pero su fila sigue en la hoja de cálculo: usa «Recargar hoja» para limpiarla.`)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired()
      else setError(errorMessage(error))
      setDeleting(false)
    }
  }

  return <dialog ref={dialogRef} aria-labelledby="detail-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === dialogRef.current) onClose() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-black/70">
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex items-start justify-between gap-4"><div><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">Registro #{registration.id}</p><h2 id="detail-title" className="break-words text-2xl font-bold">{registration.full_name}</h2></div><button autoFocus onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-300" aria-label="Cerrar detalle"><X size={22} aria-hidden="true" /></button></div>
      <dl className="grid gap-5 border-y border-slate-700 py-6 sm:grid-cols-2">{[
        ['Correo electrónico', registration.email], ['Empresa', registration.company],
        ['Fecha de alta', displayDate(registration.created_at)], ['Estado', registration.completed_at ? 'Encuesta completa' : 'Solo datos de contacto'],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl>
      <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/50 p-5">
        <h3 className="mb-3 text-sm font-semibold">Uso de la opinión como testimonio</h3>
        <OpinionConsent consent={registration.opinion_consent} />
        {registration.opinion_consent_at && <p className="mt-3 text-xs text-slate-400">Decisión registrada el {displayDate(registration.opinion_consent_at)}.</p>}
        {registration.opinion_consent_text && <p className="mt-2 text-xs leading-5 text-slate-400">Texto presentado: «{registration.opinion_consent_text}».</p>}
      </div>
      {registration.completed_at ? <div className="space-y-6 pt-6">
        <h3 className="text-lg font-semibold">Respuestas de la encuesta</h3>
        <dl className="space-y-5">
          <div><dt className="text-xs text-slate-400">Servicio recibido</dt><dd className="mt-1 text-sm">{registration.service}</dd></div>
          <div><dt className="text-xs leading-5 text-slate-400">¿De qué manera aplicarás el conocimiento aprendido?</dt><dd className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm leading-6">{registration.application}</dd></div>
          <div className="grid grid-cols-2 gap-4"><div><dt className="text-xs text-slate-400">Claridad del instructor</dt><dd className="mt-2 text-sm font-semibold">{registration.clarity}</dd></div><div><dt className="text-xs text-slate-400">Calificación del servicio</dt><dd className="mt-2 font-mono text-lg font-semibold text-cyan-300">{registration.service_rating} / 5</dd></div></div>
        </dl>
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-5"><p className="text-xs text-slate-400">Kit de continuidad · Emitido el {displayDate(registration.completed_at)}</p><p className="mt-2 break-all font-mono text-sm font-semibold text-cyan-200">{registration.unique_code}</p><button className="panel-secondary mt-4" onClick={download} disabled={downloading}><Download size={15} aria-hidden="true" />{downloading ? 'Generando PDF…' : 'Descargar kit'}</button>{error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}</div>
      </div> : <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-6 text-amber-100">El participante ingresó sus datos de contacto y todavía no ha enviado la encuesta.</p>}
      <div className="mt-8 rounded-xl border border-red-400/25 bg-red-400/5 p-5">
        <h3 className="text-sm font-semibold text-red-200">Eliminar participante</h3>
        <p className="mt-2 text-xs leading-5 text-slate-400">Borra al participante de la base y quita su fila de la hoja de cálculo. No se puede deshacer.</p>
        {confirming
          ? <div className="mt-4 space-y-3">
            <p className="flex items-start gap-2 text-sm leading-6 text-red-100"><AlertTriangle size={16} className="mt-1 shrink-0" aria-hidden="true" />¿Eliminar a {registration.full_name}{registration.unique_code ? ` y su kit ${registration.unique_code}` : ''}?</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="panel-danger" onClick={remove} disabled={deleting}><Trash2 size={15} aria-hidden="true" />{deleting ? 'Eliminando…' : 'Sí, eliminar'}</button>
              <button type="button" className="panel-secondary" onClick={() => setConfirming(false)} disabled={deleting}>Cancelar</button>
            </div>
          </div>
          : <button type="button" className="panel-secondary mt-4" onClick={() => setConfirming(true)}><Trash2 size={15} aria-hidden="true" /> Eliminar registro</button>}
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  </dialog>
}
