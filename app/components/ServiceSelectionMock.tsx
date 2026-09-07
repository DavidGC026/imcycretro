'use client'

import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, ExternalLink, RotateCcw, Star } from 'lucide-react'
import type { FormValues } from './IdentificationForm'

type Props = { user: FormValues; onBack: () => void; onReset: () => void }

const GOOGLE_REVIEW_URL = 'https://www.google.com/search?q=IMCYC+Instituto+Mexicano+del+Cemento+y+del+Concreto+Google+Maps'

export function ServiceSelectionMock({ user, onBack, onReset }: Props) {
  const [step, setStep] = useState(2)
  const [reviewDone, setReviewDone] = useState(false)
  const [selectedService, setSelectedService] = useState('')
  const [application, setApplication] = useState('')
  const [clarity, setClarity] = useState('')
  const [serviceRating, setServiceRating] = useState('')
  const [testimonial, setTestimonial] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function downloadKit() {
    const content = `KIT DE CONTINUIDAD IMCYC\n\nGracias, ${user.name}.\n\nIncluye:\n- Checklist de Supervisión en Obra\n- Guía Rápida de Diagnóstico: Patologías y Fisuramiento\n- Acceso gratuito a nuestro evento mensual\n\nInstituto Mexicano del Cemento y del Concreto A.C.`
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'kit-continuidad-imcyc.txt'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <section className="space-y-7">
    <div className="flex items-start justify-between gap-4">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">Paso 0{step} / 04</p><h1 className="mt-2 text-2xl font-extrabold tracking-wide text-slate-50">{step === 2 ? 'RESPONDE LA ENCUESTA' : step === 3 ? 'DEJA TU RECOMENDACIÓN' : 'KIT DE CONTINUIDAD'}</h1><p className="mt-2 text-sm leading-6 text-slate-400">Hola, {user.name}. {step === 2 ? 'Tu opinión nos ayuda a mejorar nuestros contenidos y servicios.' : step === 3 ? 'Ayúdanos a seguir construyendo una mejor comunidad IMCYC.' : 'Descarga este material como agradecimiento por tu participación.'}</p></div>
      <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 p-2 text-emerald-300"><Star aria-hidden="true" className="h-5 w-5" /></div>
    </div>

    {step === 3 && <div className="space-y-5"><div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5"><p className="text-sm leading-6 text-slate-300">Comparte tu experiencia con IMCYC dejando una reseña en Google.</p><a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" onClick={() => setReviewDone(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300">Dejar recomendación en Google <ExternalLink className="h-4 w-4" /></a></div>{reviewDone && <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Gracias por compartir tu recomendación.</div>}<button type="button" disabled={!reviewDone} onClick={() => setStep(4)} className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">Continuar al kit</button></div>}

    {step === 2 && <div className="space-y-5"><div><label className="block text-sm font-semibold text-slate-100" htmlFor="service">Selecciona el servicio que recibiste</label><select id="service" value={selectedService} onChange={(event) => setSelectedService(event.target.value)} className="mt-2 w-full rounded-xl border border-cyan-400/50 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300"><option value="">Selecciona una opción</option><optgroup label="Gerencia de Enseñanza"><option>Certificación</option><option>Diplomado</option><option>Seminario</option><option>Congreso</option></optgroup><optgroup label="Gerencia Técnica"><option>Lab. Concreto</option><option>Ensayos Aptitud</option></optgroup></select></div><label className="block text-sm font-semibold leading-6 text-slate-100" htmlFor="application">1. ¿De qué manera aplicarás el conocimiento aprendido?<textarea id="application" value={application} onChange={(event) => setApplication(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-normal text-slate-100 outline-none focus:border-cyan-400" placeholder="Comparte tu respuesta..." /></label><fieldset><legend className="mb-3 text-sm font-semibold leading-6 text-slate-100">2. ¿Cómo calificarías la claridad del instructor?</legend><div className="grid grid-cols-3 gap-2">{['Regular', 'Buena', 'Mala'].map((option) => <button type="button" key={option} aria-pressed={clarity === option} onClick={() => setClarity(option)} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${clarity === option ? 'border-cyan-300 bg-cyan-400/15 text-cyan-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{option}</button>)}</div></fieldset><fieldset><legend className="mb-3 text-sm font-semibold leading-6 text-slate-100">3. Calificación del servicio</legend><div className="grid grid-cols-6 gap-2">{[0,1,2,3,4,5].map((value) => <button type="button" key={value} aria-label={`Calificación ${value} de 5`} aria-pressed={serviceRating === String(value)} onClick={() => setServiceRating(String(value))} className={`rounded-lg border py-2 text-sm font-bold transition ${serviceRating === String(value) ? 'border-yellow-300 bg-yellow-300/15 text-yellow-200' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}>{value}</button>)}</div></fieldset><label className="flex items-start gap-3 text-xs leading-5 text-slate-300"><input type="checkbox" checked={testimonial} onChange={(event) => setTestimonial(event.target.checked)} className="mt-1 accent-cyan-500" />Autorizo el uso de mi opinión como testimonio.</label>{submitted && <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">Gracias por responder la encuesta.</p>}<button type="button" disabled={!selectedService || !application.trim() || !clarity || !serviceRating} onClick={() => { setSubmitted(true); setStep(3) }} className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">Enviar encuesta</button></div>}

    {step === 4 && <div className="space-y-5"><div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5"><p className="mb-4 text-sm font-semibold text-slate-100">Tu kit incluye:</p><ul className="space-y-3 text-sm leading-6 text-slate-300"><li className="border-l-2 border-cyan-400 pl-3">Checklist de Supervisión en Obra</li><li className="border-l-2 border-cyan-400 pl-3">Guía Rápida de Diagnóstico</li><li className="border-l-2 border-cyan-400 pl-3">Acceso gratuito a nuestro evento mensual</li></ul></div><button type="button" onClick={downloadKit} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"><Download className="h-4 w-4" /> Descargar kit de continuidad</button></div>}

    <div className="flex items-center justify-between border-t border-slate-700/70 pt-5"><button type="button" onClick={step === 2 ? onBack : () => setStep(step - 1)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition hover:text-cyan-300"><ArrowLeft className="h-4 w-4" /> Volver</button><button type="button" onClick={onReset} className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 transition hover:text-red-300"><RotateCcw className="h-3.5 w-3.5" /> Reiniciar</button></div>
  </section>
}

export type { Props as ServiceSelectionProps }

