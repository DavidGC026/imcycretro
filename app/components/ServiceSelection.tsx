'use client'

import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, ExternalLink, RotateCcw, Star } from 'lucide-react'
import { api, errorMessage } from '@/lib/api'
import { discountText, opinionConsentText, serviceGroups, type Identity, type Registration } from '@/lib/registration'

type Props = { user: Identity; registration: Registration | null; onBack: () => void; onReset: () => Promise<void> }
const GOOGLE_REVIEW_URL = 'https://www.google.com/search?q=IMCYC+Instituto+Mexicano+del+Cemento+y+del+Concreto+Google+Maps'

export function ServiceSelection({ user, registration, onBack, onReset }: Props) {
  const [step, setStep] = useState(registration?.completed_at ? 4 : 2)
  const [reviewDone, setReviewDone] = useState(false)
  const [selectedService, setSelectedService] = useState(registration?.service ?? '')
  const [application, setApplication] = useState(registration?.application ?? '')
  const [clarity, setClarity] = useState(registration?.clarity ?? '')
  const [serviceRating, setServiceRating] = useState<number | null>(registration?.service_rating ?? null)
  const [opinionConsent, setOpinionConsent] = useState(registration?.opinion_consent === true)
  const [code, setCode] = useState(registration?.unique_code ?? '')
  const [issuedAt, setIssuedAt] = useState(registration?.completed_at ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function submitSurvey() {
    if (saving) return
    if (code) { setStep(3); return }
    if (!selectedService || !application.trim() || !clarity || serviceRating === null) return
    setSaving(true)
    setError('')
    try {
      const result = await api<{ code: string; issuedAt: string }>('survey.submit', {
        body: { service: selectedService, application: application.trim(), clarity, serviceRating, opinionConsent },
      })
      setCode(result.code)
      setIssuedAt(result.issuedAt)
      setStep(3)
    } catch (error) { setError(errorMessage(error)) }
    finally { setSaving(false) }
  }

  async function downloadPdf() {
    setDownloading(true)
    setError('')
    try {
      const { downloadKit } = await import('@/lib/download-kit')
      await downloadKit({ name: user.name, company: user.company, service: selectedService, code, issuedAt })
    } catch (error) { setError(errorMessage(error)) }
    finally { setDownloading(false) }
  }

  const canSubmit = selectedService && application.trim() && clarity && serviceRating !== null

  return <section className="space-y-7">
    <div className="flex items-start justify-between gap-4">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">Paso 0{step} / 04</p><h1 className="mt-2 text-2xl font-extrabold tracking-wide text-slate-50">{step === 2 ? 'RESPONDE LA ENCUESTA' : step === 3 ? 'DEJA TU RECOMENDACIÓN' : 'KIT DE CONTINUIDAD'}</h1><p className="mt-2 text-sm leading-6 text-slate-400">Hola, {user.name}. {step === 2 ? 'Selecciona el servicio y responde las tres preguntas.' : step === 3 ? 'Ayúdanos a seguir construyendo una mejor comunidad IMCYC.' : 'Descarga tu beneficio como agradecimiento por tu participación.'}</p></div>
      <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 p-2 text-emerald-300"><Star aria-hidden="true" className="h-5 w-5" /></div>
    </div>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {step === 2 && <form onSubmit={(event) => { event.preventDefault(); void submitSurvey() }} className="space-y-5">
      <fieldset disabled={saving || !!code} className="space-y-5">
        <label className="block text-sm font-semibold text-slate-100" htmlFor="service">Selecciona el servicio que recibiste<select id="service" required value={selectedService} onChange={(event) => setSelectedService(event.target.value)} className="mt-2 w-full rounded-xl border border-cyan-400/50 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300"><option value="">Selecciona una opción</option>{Object.entries(serviceGroups).map(([group, items]) => <optgroup label={group} key={group}>{items.map((service) => <option key={service}>{service}</option>)}</optgroup>)}</select></label>
        <label className="block text-sm font-semibold leading-6 text-slate-100" htmlFor="application">1. ¿De qué manera aplicarás el conocimiento aprendido?<textarea id="application" required maxLength={4000} value={application} onChange={(event) => setApplication(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-normal text-slate-100 outline-none focus:border-cyan-400" placeholder="Comparte tu respuesta..." /></label>
        <fieldset><legend className="mb-3 text-sm font-semibold leading-6 text-slate-100">2. ¿Cómo calificarías la claridad del instructor?</legend><div className="grid grid-cols-3 gap-2">{['Regular', 'Buena', 'Mala'].map((option) => <button type="button" key={option} aria-pressed={clarity === option} onClick={() => setClarity(option)} className={`rounded-xl border px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-cyan-300 ${clarity === option ? 'border-cyan-300 bg-cyan-400/15 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{option}</button>)}</div></fieldset>
        <fieldset><legend className="mb-3 text-sm font-semibold leading-6 text-slate-100">3. Calificación del servicio (0–5)</legend><div className="grid grid-cols-6 gap-2">{[0, 1, 2, 3, 4, 5].map((value) => <button type="button" key={value} aria-pressed={serviceRating === value} onClick={() => setServiceRating(value)} className={`rounded-xl border px-2 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-cyan-300 ${serviceRating === value ? 'border-cyan-300 bg-cyan-400/15 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{value}</button>)}</div></fieldset>
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
          <label htmlFor="opinion-consent" className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-100">
            <input id="opinion-consent" type="checkbox" checked={opinionConsent} onChange={(event) => setOpinionConsent(event.target.checked)} aria-describedby="opinion-consent-help" className="mt-1 h-4 w-4 shrink-0 accent-cyan-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" />
            <span>{opinionConsentText}</span>
          </label>
          <p id="opinion-consent-help" className="mt-2 pl-7 text-xs leading-5 text-slate-400">Opcional. Puedes continuar y obtener tu kit aunque no autorices.</p>
        </div>
      </fieldset>
      {code && <p className="text-xs text-emerald-300">Tu encuesta ya está guardada.</p>}
      <button type="submit" disabled={!canSubmit || saving} className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 focus-visible:outline-2 focus-visible:outline-emerald-200 disabled:opacity-40">{saving ? 'Registrando...' : 'Continuar'}</button>
    </form>}
    {step === 3 && <div className="space-y-5">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5"><p className="text-sm leading-6 text-slate-300">Comparte tu experiencia con IMCYC dejando una reseña en Google.</p><a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" onClick={() => setReviewDone(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white">Dejar recomendación en Google <ExternalLink className="h-4 w-4" aria-hidden="true" /></a></div>
      {reviewDone && <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Se abrió la página de reseñas. Puedes continuar a tu kit.</div>}
      <button type="button" disabled={!reviewDone} onClick={() => setStep(4)} className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">Continuar al kit</button>
    </div>}
    {step === 4 && <div className="space-y-5">
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5"><p className="text-sm font-semibold text-emerald-200">Kit aprobado</p><p className="mt-2 text-lg font-bold text-slate-50">{discountText}</p><p className="mt-3 break-words text-xs text-slate-300">Tu ID único: <span className="font-mono text-cyan-300">{code}</span></p><p className="mt-3 text-xs leading-5 text-slate-400">Válido 14 días naturales a partir de la fecha de emisión. No transferible. No acumulable con otros descuentos, becas o promociones. Descuento aplicable sobre el precio lista antes de IVA.</p></div>
      <button type="button" onClick={downloadPdf} disabled={downloading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"><Download className="h-4 w-4" aria-hidden="true" />{downloading ? 'Generando PDF…' : 'Descargar kit en PDF'}</button>
    </div>}
    <div className="flex items-center justify-between border-t border-slate-700/70 pt-5">
      <button type="button" disabled={saving || (step === 2 && !!code)} onClick={step === 2 ? onBack : () => setStep(step - 1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 disabled:opacity-40"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver</button>
      <button type="button" disabled={saving} onClick={onReset} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reiniciar</button>
    </div>
  </section>
}
