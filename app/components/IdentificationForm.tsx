'use client'

import { useState } from 'react'
import { Building2, CheckCircle2, Loader2, Mail, UserRound } from 'lucide-react'

type FormValues = { name: string; company: string; email: string }

type Props = {
  initialValues?: FormValues
  onSubmit: (values: FormValues) => void
}

const fields = [
  { key: 'name', label: 'Nombre completo', placeholder: 'Escribe tu nombre aquí...', icon: UserRound, type: 'text' },
  { key: 'company', label: 'Empresa', placeholder: 'Nombre de la empresa...', icon: Building2, type: 'text' },
  { key: 'email', label: 'Email', placeholder: 'Correo electrónico de contacto', icon: Mail, type: 'email' },
] as const

export function IdentificationForm({ initialValues, onSubmit }: Props) {
  const [values, setValues] = useState<FormValues>(initialValues ?? { name: '', company: '', email: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: Partial<Record<keyof FormValues, string>> = {}
    if (!values.name.trim()) nextErrors.name = 'Escribe tu nombre completo.'
    if (!values.company.trim()) nextErrors.company = 'Indica el nombre de tu empresa.'
    if (!values.email.trim()) nextErrors.email = 'Escribe un correo electrónico.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) nextErrors.email = 'Revisa el formato de tu correo.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      setNotice('Completa los campos marcados para continuar.')
      return
    }
    setNotice('')
    setLoading(true)
    window.setTimeout(() => { setLoading(false); onSubmit({ name: values.name.trim(), company: values.company.trim(), email: values.email.trim() }) }, 650)
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-cyan-300">Comunidad IMCYC</p>
        <h1 className="text-3xl font-extrabold tracking-[0.12em] text-slate-50">IDENTIFÍCATE</h1>
        <p className="max-w-sm text-sm leading-6 text-slate-400">Ingresa tus datos para acceder a la comunidad y continuar con tu registro.</p>
      </div>
      <div className="space-y-4">
        {fields.map(({ key, label, placeholder, icon: Icon, type }) => (
          <div key={key} className="space-y-2">
            <label htmlFor={key} className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Icon aria-hidden="true" className="h-4 w-4 text-cyan-300" />{label} <span aria-hidden="true" className="text-slate-300">*</span></label>
            <div className="relative">
              <input id={key} name={key} type={type} value={values[key]} placeholder={placeholder} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} onChange={(e) => { setValues({ ...values, [key]: e.target.value }); setErrors({ ...errors, [key]: undefined }) }} className={`w-full rounded-xl border bg-slate-800/80 px-4 py-3.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-400/70 ${errors[key] ? 'border-red-400/80 focus:ring-red-400/50' : 'border-slate-700/80 focus:border-cyan-400/70'}`} />
              {values[key] && !errors[key] && <CheckCircle2 aria-hidden="true" className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />}
            </div>
            {errors[key] && <p id={`${key}-error`} className="text-xs text-red-300">{errors[key]}</p>}
          </div>
        ))}
      </div>
      {notice && <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">{notice}</div>}
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-700/70 pt-5">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-7 py-3.5 text-sm font-bold tracking-[0.18em] text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-wait disabled:opacity-70">{loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />} {loading ? 'VALIDANDO' : 'INGRESAR'}</button>
        <span aria-hidden="true" className="h-8 w-0.5 rounded-full bg-red-500" />
        <span className="text-sm font-medium text-slate-100">Campos Obligatorios <span className="text-slate-300">*</span></span>
      </div>
    </form>
  )
}

export type { FormValues }
