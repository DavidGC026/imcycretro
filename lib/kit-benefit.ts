export type KitBenefit = {
  title: string
  benefit: string
  description: string
  validityDays: number
  conditions: string
  whatsapp: string
  email: string
}

// Used only for kits issued before configurable benefits were introduced.
export const originalKitBenefit: KitBenefit = {
  title: 'KIT DE CONTINUIDAD',
  benefit: '10% DE DESCUENTO',
  description: 'EN CUALQUIER CONSTANCIA DE APTITUD',
  validityDays: 30,
  conditions: 'No transferible. No acumulable con otros descuentos, becas o promociones. Descuento aplicable sobre el precio lista antes de IVA.',
  whatsapp: '55 2104 5612',
  email: 'cursos@imcyc.com',
}

export function kitConditions(benefit: KitBenefit): string {
  return `Válido ${benefit.validityDays} ${benefit.validityDays === 1 ? 'día natural' : 'días naturales'} a partir de la fecha de emisión. ${benefit.conditions}`
}

export function kitWhatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits.length === 10 ? '52' : ''}${digits}`
}
