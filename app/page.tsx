'use client'

import { useState } from 'react'
import { IdentificationForm, type FormValues } from './components/IdentificationForm'
import { ServiceSelectionMock } from './components/ServiceSelectionMock'

export default function Page() {
  const [user, setUser] = useState<FormValues | null>(null)
  const [step, setStep] = useState(1)

  function handleSubmit(values: FormValues) {
    sessionStorage.setItem('imcyc-user', JSON.stringify(values))
    setUser(values)
    setStep(2)
  }

  function reset() { sessionStorage.removeItem('imcyc-user'); setUser(null); setStep(1) }

  return <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6">
    <div className="w-full max-w-lg">
      <div className="mb-4 flex items-center justify-between gap-4 px-2"><div className="flex items-center gap-3"><div className="flex h-12 w-32 items-center justify-center overflow-hidden rounded-lg bg-transparent"><img src="/logo-imcyc.png" alt="Logo del Instituto Mexicano del Cemento y del Concreto" className="h-full w-full object-contain" /></div><span className="font-mono text-[11px] font-bold tracking-[0.3em] text-slate-400">IMCYC / 2027</span></div><span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Acceso seguro</span></div>
      <div className="overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex h-11 items-center border-b border-slate-800 bg-slate-950/70 px-5"><span className="h-3 w-3 rounded-full bg-red-500" /><span className="ml-2 h-3 w-3 rounded-full bg-yellow-500" /><span className="ml-2 h-3 w-3 rounded-full bg-green-500" /><span className="mx-auto h-1.5 w-24 rounded-full bg-slate-800" /><span className="w-14" /></div>
        <div className="p-6 sm:p-9">{step === 1 ? <IdentificationForm onSubmit={handleSubmit} /> : user && <ServiceSelectionMock user={user} onBack={() => setStep(1)} onReset={reset} />}</div>
      </div>
      <p className="mt-6 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">Instituto Mexicano del Cemento y del Concreto A.C. — Interfaz de acceso de usuario</p>
    </div>
  </main>
}
