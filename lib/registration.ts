export type Identity = { name: string; company: string; email: string }

export const serviceGroups = {
  'Gerencia de Enseñanza': ['Certificación', 'Diplomado', 'Seminario', 'Congreso'],
  'Gerencia Técnica': ['Lab. Concreto', 'Ensayos Aptitud'],
}

export const discountText = '10% DE DESCUENTO EN CUALQUIER CONSTANCIA DE APTITUD.'
export const opinionConsentText = 'Autorizo el uso de mi opinión como testimonio'

export function opinionConsentLabel(consent: boolean | null) {
  return consent === true ? 'Autorizó' : consent === false ? 'No autorizó' : 'Sin autorización registrada'
}

export type Registration = {
  id: number
  full_name: string
  company: string
  email: string
  service: string | null
  application: string | null
  clarity: string | null
  service_rating: number | null
  unique_code: string | null
  created_at: string
  completed_at: string | null
  opinion_consent: boolean | null
  opinion_consent_at: string | null
  opinion_consent_text: string | null
}

export type RegistrationResults = {
  registrations: Registration[]
  total: number
  page: number
  pageSize: number
  stats: { total: number; completed: number; pending: number; averageRating: number | null }
}

export function displayDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City',
  }).format(new Date(value))
}
