'use client'

import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, ExternalLink, RotateCcw, Star } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { FormValues } from './IdentificationForm'

type Props = { user: FormValues; onBack: () => void; onReset: () => void }
const DISCOUNT = '10% DE DESCUENTO EN CUALQUIER CONSTANCIA DE APTITUD.'
const GOOGLE_REVIEW_URL = 'https://www.google.com/search?q=IMCYC+Instituto+Mexicano+del+Cemento+y+del+Concreto+Google+Maps'
const services = { 'Gerencia de Enseñanza': ['Certificación', 'Diplomado', 'Seminario', 'Congreso'], 'Gerencia Técnica': ['Lab. Concreto', 'Ensayos Aptitud'] }

function createCode() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `IMCYC-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export function ServiceSelectionMock({ user, onBack, onReset }: Props) {
  const [step, setStep] = useState(2)
  const [reviewDone, setReviewDone] = useState(false)
  const [selectedService, setSelectedService] = useState('')
  const [application, setApplication] = useState('')
  const [clarity, setClarity] = useState('')
  const [serviceRating, setServiceRating] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitSurvey() {
    if (!selectedService || !application.trim() || !clarity || serviceRating === null) return
    setSaving(true); setError('')
    const uniqueCode = createCode()
    const { error: insertError } = await getSupabaseClient().from('kit_redemptions').insert({ unique_code: uniqueCode, full_name: user.name, email: user.email, company: user.company, service: selectedService, discount_text: DISCOUNT })
    if (insertError) { setError('No pudimos registrar tu kit. Intenta nuevamente.'); setSaving(false); return }
    setCode(uniqueCode); setSubmitted(true); setSaving(false); setStep(3)
  }

  function downloadKit() {
    const pdf = new jsPDF()
    pdf.setFillColor(7, 18, 38); pdf.rect(0, 0, 210, 297, 'F')
    pdf.setTextColor(41, 190, 232); pdf.setFontSize(24); pdf.text('IMCYC', 20, 30)
    pdf.setTextColor(240, 245, 250); pdf.setFontSize(18); pdf.text('KIT DE CONTINUIDAD', 20, 52)
    pdf.setFontSize(12); pdf.text('Gracias por participar en nuestra experiencia.', 20, 68)
    pdf.setTextColor(41, 190, 232); pdf.setFontSize(15); pdf.text(DISCOUNT, 20, 92, { maxWidth: 170 })
    pdf.setTextColor(220, 228, 240); pdf.setFontSize(11); pdf.text(`Beneficiario: ${user.name}`, 20, 125); pdf.text(`Empresa: ${user.company}`, 20, 137); pdf.text(`Servicio: ${selectedService}`, 20, 149)
    pdf.setDrawColor(41, 190, 232); pdf.rect(20, 168, 170, 28); pdf.setTextColor(240, 245, 250); pdf.setFontSize(10); pdf.text('ID ÚNICO DE BENEFICIO', 28, 180); pdf.setFontSize(16); pdf.text(code, 28, 190)
    pdf.setTextColor(150, 165, 185); pdf.setFontSize(10); pdf.text('Válido para cualquier Constancia de Aptitud.', 20, 225); pdf.text('Instituto Mexicano del Cemento y del Concreto A.C.', 20, 260)
    pdf.save(`kit-continuidad-${code}.pdf`)
  }

  const canSubmit = selectedService && application.trim() && clarity && serviceRating !== null
  return <section className="space-y-7">
    <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">Paso 0{step} / 04</p><h1 className="mt-2 text-2xl font-extrabold tracking-wide text-slate-50">{step === 2 ? 'RESPONDE LA ENCUESTA' : step === 3 ? 'DEJA TU RECOMENDACIÓN' : 'KIT DE CONTINUIDAD'}</h1><p className="mt-2 text-sm leading-6 text-slate-400">Hola, {user.name}. {step === 2 ? 'Selecciona el servicio y responde las tres preguntas.' : step === 3 ? 'Ayúdanos a seguir construyendo una mejor comunidad IMCYC.' : 'Descarga tu beneficio como agradecimiento por tu participación.'}</p></div><div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 p-2 text-emerald-300"><Star aria-hidden="true" className="h-5 w-5" /></div></div>
    {step === 2 && <div className="space-y-5"><label className="block text-sm font-semibold text-slate-100" htmlFor="service">Selecciona el servicio que recibiste<select id="service" value={selectedService} onChange={(event) => setSelectedService(event.target.value)} className="mt-2 w-full rounded-xl border border-cyan-400/50 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300"><option value="">Selecciona una opción</option>{Object.entries(services).map(([group, items]) => <optgroup label={group} key={group}>{items.map((service) => <option key={service}>{service}</option>)}</optgroup>)}</select></label><label className="block text-sm font-semibold leading-6 text-slate-100" htmlFor="application">1. ¿De qué manera aplicarás el conocimiento aprendido?<textarea id="application" value={application} onChange={(event) => setApplication(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-normal text-slate-100 outline-none focus:border-cyan-400" placeholder="Comparte tu respuesta..." /></label><fieldset><legend className="mb-3 text-sm font-semibold leading-6 text-slate-100">2. ¿Cómo calificarías la claridad del instructor?</legend><div className="grid grid-cols-3 gap-2">{['Regular', 'Buena', 'Mala'].map((option) => <button type="button" key={option} aria-pressed={clarity === option} onClick={() => setClarity(option)} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${clarity === option ? 'border-cyan-300 bg-cyan-400/15 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{option}</button>)}</div></fieldset><fieldset><legend className="mb-3 text-sm font-semibold leading-6 text-slate-100">3. Calificación del servicio (0–5)</legend><div className="grid grid-cols-6 gap-2">{[0, 1, 2, 3, 4, 5].map((value) => <button type="button" key={value} aria-pressed={serviceRating === value} onClick={() => setServiceRating(value)} className={`rounded-xl border px-2 py-3 text-sm font-bold ${serviceRating === value ? 'border-cyan-300 bg-cyan-400/15 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>{value}</button>)}</div></fieldset>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}<button type="button" disabled={!canSubmit || saving} onClick={submitSurvey} className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">{saving ? 'Registrando...' : 'Continuar'}</button></div>}
    {step === 3 && <div className="space-y-5"><div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5"><p className="text-sm leading-6 text-slate-300">Comparte tu experiencia con IMCYC dejando una reseña en Google.</p><a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" onClick={() => setReviewDone(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white">Dejar recomendación en Google <ExternalLink className="h-4 w-4" /></a></div>{reviewDone && <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Gracias por compartir tu recomendación.</div>}<button type="button" disabled={!reviewDone} onClick={() => setStep(4)} className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">Continuar al kit</button></div>}
    {step === 4 && <div className="space-y-5"><div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5"><p className="text-sm font-semibold text-emerald-200">Kit aprobado</p><p className="mt-2 text-lg font-bold text-slate-50">{DISCOUNT}</p><p className="mt-3 text-xs text-slate-300">Tu ID único: <span className="font-mono text-cyan-300">{code}</span></p></div><button type="button" onClick={downloadKit} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950"><Download className="h-4 w-4" /> Descargar kit en PDF</button></div>}
    <div className="flex items-center justify-between border-t border-slate-700/70 pt-5"><button type="button" onClick={step === 2 ? onBack : () => setStep(step - 1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300"><ArrowLeft className="h-4 w-4" /> Volver</button><button type="button" onClick={onReset} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><RotateCcw className="h-3.5 w-3.5" /> Reiniciar</button></div>
  </section>
}

export type { Props as ServiceSelectionProps }
