'use client'

import { useEffect, useState } from 'react'
import { api, errorMessage } from '@/lib/api'
import { assetPath } from '@/lib/paths'
import type { Registration } from '@/lib/registration'
import { IdentificationForm, type FormValues } from './components/IdentificationForm'
import { ServiceSelection } from './components/ServiceSelection'

export default function Page() {
  const [user, setUser] = useState<FormValues | null>(null)
  const [step, setStep] = useState(1)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ registration: Registration | null }>('registration.current')
      .then(({ registration }) => {
        if (!registration) return
        setRegistration(registration)
        setUser({ name: registration.full_name, email: registration.email, company: registration.company })
        setStep(2)
      })
      .catch((error) => setError(errorMessage(error)))
      .finally(() => setLoading(false))
  }, [])

  function handleSubmit(values: FormValues) {
    setError('')
    setUser(values)
    setStep(2)
  }

  async function reset() {
    try {
      await api('registration.reset', { body: {} })
      setUser(null)
      setRegistration(null)
      setStep(1)
      setError('')
    } catch (error) {
      setError(errorMessage(error))
    }
  }

  return <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6">
    <div className="w-full max-w-lg">
      <div className="mb-4 flex items-center justify-between gap-4 px-2"><div className="flex items-center gap-3"><div className="flex h-12 w-24 items-center justify-center overflow-hidden rounded-lg bg-transparent"><img src={assetPath('/logo-imcyc.png')} alt="Logo del Instituto Mexicano del Cemento y del Concreto" className="h-full w-full object-contain" /></div><span className="font-mono text-[11px] font-bold tracking-[0.3em] text-slate-400">IMCYC / 2027</span></div><span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">Acceso seguro</span></div>
      <div className="overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex h-11 items-center border-b border-slate-800 bg-slate-950/70 px-5"><span className="h-3 w-3 rounded-full bg-red-500" /><span className="ml-2 h-3 w-3 rounded-full bg-yellow-500" /><span className="ml-2 h-3 w-3 rounded-full bg-green-500" /><span className="mx-auto h-1.5 w-24 rounded-full bg-slate-800" /><span className="w-14" /></div>
        <div className="p-6 sm:p-9">
          {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
          {loading ? <p role="status" className="py-8 text-center text-sm text-slate-400">Cargando tu registro…</p> : step === 1 ? <IdentificationForm initialValues={user ?? undefined} onSubmit={handleSubmit} /> : user && <ServiceSelection user={user} registration={registration} onBack={() => setStep(1)} onReset={reset} />}
        </div>
      </div>
      <p className="mt-6 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">Instituto Mexicano del Cemento y del Concreto A.C. — Interfaz de acceso de usuario</p>
    </div>
  </main>
}
