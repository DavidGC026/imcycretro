import { jsPDF } from 'jspdf'
import type { KitBenefit } from './kit-benefit'

export type KitDetails = {
  name: string
  company: string
  service: string
  code: string
  issuedAt: string
  benefit: KitBenefit
  example?: boolean
}

export type KitAssets = {
  logo: Uint8Array
  titleFont: string
  subtitleFont: string
}

const BLUE = '#0077AA'
const GRAY = '#888888'

// Formato vertical de 8 × 10 pulgadas, con las proporciones de la referencia.
export function createKitPdf(details: KitDetails, assets: KitAssets) {
  const benefit = details.benefit
  const pdf = new jsPDF({ unit: 'pt', format: [576, 720], compress: true })
  pdf.setProperties({ title: 'Kit de continuidad IMCYC', subject: details.code, author: 'Instituto Mexicano del Cemento y del Concreto A.C.' })
  pdf.addFileToVFS('Poppins-Bold.ttf', assets.titleFont)
  pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
  pdf.addFileToVFS('Poppins-Medium.ttf', assets.subtitleFont)
  pdf.addFont('Poppins-Medium.ttf', 'Poppins', 'normal')

  pdf.setFillColor('#F5F7F8')
  pdf.rect(0, 0, 576, 720, 'F')
  pdf.addImage(assets.logo, 'PNG', 208, 18, 160, 105, undefined, 'FAST')

  pdf.setFont('Poppins', 'bold')
  pdf.setFontSize(27)
  pdf.setTextColor(GRAY)
  centeredText(pdf, benefit.title, 288, 152, 480, 27, 10)
  pdf.setFont('Poppins', 'normal')
  pdf.setFontSize(15)
  pdf.text('Gracias por participar en nuestra experiencia.', 288, 173, { align: 'center' })
  if (details.example) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor('#9D3030')
    pdf.text('EJEMPLO - SIN VALIDEZ', 288, 187, { align: 'center' })
  }

  roundedCard(pdf, 52, 192, 472, 119, 20, '#008ABD')
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(BLUE)
  centeredBlock(pdf, benefit.benefit, 288, 207, 438, 53, 36, 10)
  centeredBlock(pdf, benefit.description, 288, 270, 438, 29, 17, 7)

  roundedCard(pdf, 52, 329, 472, 157, 27, '#E0E2E4')
  const issueDate = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City',
  }).format(new Date(details.issuedAt))
  const rows = [
    ['Fecha:', issueDate], ['Beneficiario:', details.name],
    ['Empresa:', details.company], ['Servicio:', details.service],
  ]
  rows.forEach(([label, value], index) => {
    const baseline = 361 + index * 35.5
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor('#707478')
    pdf.setFontSize(11)
    pdf.text(label, 81, baseline)
    pdf.setTextColor('#2D3439')
    fitText(pdf, value, 198, baseline, 303, 11.5)
  })

  pdf.setFillColor('#B4B7B8')
  pdf.roundedRect(52, 509.5, 472, 81, 13, 13, 'F')
  pdf.setFillColor(BLUE)
  pdf.roundedRect(52, 507.5, 472, 81, 13, 13, 'F')
  pdf.setTextColor('#FFFFFF')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text(details.example ? 'DOCUMENTO DE EJEMPLO - SIN VALIDEZ' : 'MENCIONE ESTE ID AL REGISTRARSE', 288, 531, { align: 'center' })
  pdf.setFontSize(22)
  centeredText(pdf, details.example ? 'EJEMPLO' : details.code, 288, 566, 435, 22, 13)

  pdf.setTextColor('#0078AB')
  pdf.setFontSize(14)
  pdf.text('Haz válido tu kit:', 288, 609, { align: 'center' })
  const digits = benefit.whatsapp.replace(/\D/g, '')
  contactLine(pdf, 'WhatsApp directo: ', benefit.whatsapp, 626, `https://wa.me/${digits.length === 10 ? '52' : ''}${digits}`, true)
  const contactBottom = contactLine(pdf, 'Correo Electrónico: ', benefit.email, 643, `mailto:${benefit.email}`)

  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(GRAY)
  pdf.setFontSize(10)
  const conditions = `Válido ${benefit.validityDays} ${benefit.validityDays === 1 ? 'día natural' : 'días naturales'} a partir de la fecha de emisión. ${benefit.conditions}`
  const conditionsTop = Math.max(654, contactBottom + 8)
  centeredBlock(pdf, conditions, 288, conditionsTop, 482, 692 - conditionsTop, 10, 5.5)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor('#83888C')
  pdf.setFontSize(9)
  pdf.text('Instituto Mexicano del Cemento y del Concreto A.C.', 288, 700, { align: 'center' })
  pdf.setFillColor('#DDE0E3')
  pdf.rect(0, 707.5, 576, 12.5, 'F')
  pdf.setDrawColor('#BEC1C3')
  pdf.setLineWidth(0.5)
  pdf.line(0, 719.5, 576, 719.5)
  return pdf
}

function contactLine(pdf: jsPDF, label: string, value: string, y: number, url: string, underline = false) {
  pdf.setFontSize(10)
  while (pdf.getTextWidth(label + value) > 480 && pdf.getFontSize() > 8) pdf.setFontSize(pdf.getFontSize() - 0.25)
  if (pdf.getTextWidth(label + value) > 480) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    const lines = pdf.splitTextToSize(label + value, 480) as string[]
    lines.forEach((line, index) => pdf.textWithLink(line, 288 - pdf.getTextWidth(line) / 2, y + index * 8.625, { url }))
    return y + (lines.length - 1) * 8.625
  }
  pdf.setFont('helvetica', 'bold')
  const labelWidth = pdf.getTextWidth(label)
  pdf.setFont('helvetica', 'normal')
  const valueWidth = pdf.getTextWidth(value)
  const x = (576 - labelWidth - valueWidth) / 2
  pdf.setFont('helvetica', 'bold')
  pdf.text(label, x, y)
  pdf.setFont('helvetica', 'normal')
  pdf.textWithLink(value, x + labelWidth, y, { url })
  if (underline) {
    pdf.setDrawColor('#0078AB')
    pdf.setLineWidth(0.5)
    pdf.line(x + labelWidth, y + 1.2, x + labelWidth + valueWidth, y + 1.2)
  }
  return y
}

function centeredText(pdf: jsPDF, text: string, x: number, y: number, width: number, size: number, minimum: number) {
  pdf.setFontSize(size)
  while (pdf.getTextWidth(text) > width && size > minimum) { size -= 0.25; pdf.setFontSize(size) }
  pdf.text(text, x, y, { align: 'center' })
}

function centeredBlock(pdf: jsPDF, text: string, x: number, top: number, width: number, height: number, size: number, minimum: number) {
  if (!text.trim()) return
  pdf.setFontSize(size)
  let lines = pdf.splitTextToSize(text, width) as string[]
  // Fit the entire paragraph into its own rectangle, including line spacing.
  // A line-count limit alone allows a large heading to collide with its subtitle.
  while (lines.length * size * 1.15 > height && size > minimum) {
    size -= 0.25; pdf.setFontSize(size); lines = pdf.splitTextToSize(text, width) as string[]
  }
  const offset = Math.max(0, (height - lines.length * size * 1.15) / 2)
  pdf.text(lines, x, top + offset, { align: 'center', baseline: 'top', lineHeightFactor: 1.15 })
}

function roundedCard(pdf: jsPDF, x: number, y: number, width: number, height: number, radius: number, border: string) {
  pdf.setFillColor('#C7C9CA')
  pdf.roundedRect(x, y + 2, width, height, radius, radius, 'F')
  pdf.setFillColor('#FFFFFF')
  pdf.setDrawColor(border)
  pdf.setLineWidth(0.65)
  pdf.roundedRect(x, y, width, height, radius, radius, 'FD')
}

function fitText(pdf: jsPDF, value: string, x: number, y: number, width: number, initialSize: number) {
  let size = initialSize
  pdf.setFontSize(size)
  const text = value.replace(/\s+/g, ' ').trim()
  while (size > 7 && pdf.getTextWidth(text) > width) {
    size -= 0.25
    pdf.setFontSize(size)
  }
  pdf.setFontSize(size)
  const lines = pdf.splitTextToSize(text, width) as string[]
  // Las filas admiten varias líneas si el nombre o la empresa son extensos.
  pdf.text(lines, x, y - (lines.length > 1 ? 4 : 0), { lineHeightFactor: 1.1 })
}
