import { opinionConsentLabel } from '@/lib/registration'

export function OpinionConsent({ consent }: { consent: boolean | null }) {
  const color = consent === true ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
    : consent === false ? 'border-rose-400/25 bg-rose-400/10 text-rose-200'
      : 'border-slate-600 bg-slate-800 text-slate-300'
  return <span className={`inline-block rounded-lg border px-2.5 py-1 text-[11px] font-medium leading-5 ${color}`}>{opinionConsentLabel(consent)}</span>
}
