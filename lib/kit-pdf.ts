import { jsPDF } from 'jspdf'

export type KitDetails = {
  name: string
  company: string
  service: string
  code: string
  issuedAt: string
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
  const pdf = new jsPDF({ unit: 'pt', format: [576, 720], compress: true })
  pdf.setProperties({ title: 'Kit de continuidad IMCYC', subject: details.code, author: 'Instituto Mexicano del Cemento y del Concreto A.C.' })
  pdf.addFileToVFS('Poppins-Bold.ttf', assets.titleFont)
  pdf.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
  pdf.addFileToVFS('Poppins-Medium.ttf', assets.subtitleFont)
  pdf.addFont('Poppins-Medium.ttf', 'Poppins', 'normal')

  pdf.setFillColor('#F5F7F8')
  pdf.rect(0, 0, 576, 720, 'F')
  pdf.setFillColor('#DDE0E3')
  pdf.rect(0, 0, 576, 13, 'F')
  pdf.setDrawColor('#BEC1C3')
  pdf.setLineWidth(0.5)
  pdf.line(0, 13, 576, 13)
  pdf.addImage(assets.logo, 'PNG', 221, 33, 134, 88, undefined, 'FAST')

  pdf.setFont('Poppins', 'bold')
  pdf.setFontSize(27)
  pdf.setTextColor(GRAY)
  pdf.text('KIT DE CONTINUIDAD', 288, 158, { align: 'center' })
  pdf.setFont('Poppins', 'normal')
  pdf.setFontSize(15)
  pdf.text('Gracias por participar en nuestra experiencia.', 288, 179, { align: 'center' })

  roundedCard(pdf, 52, 203, 472, 119, 20, '#008ABD')
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(BLUE)
  pdf.setFontSize(40)
  pdf.text('10% DE DESCUENTO', 288, 266, { align: 'center' })
  pdf.setFontSize(18)
  pdf.text('EN CUALQUIER CONSTANCIA DE APTITUD', 288, 293, { align: 'center' })

  roundedCard(pdf, 52, 348, 472, 157, 27, '#E0E2E4')
  const issueDate = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City',
  }).format(new Date(details.issuedAt))
  const rows = [
    ['Fecha:', issueDate], ['Beneficiario:', details.name],
    ['Empresa:', details.company], ['Servicio:', details.service],
  ]
  rows.forEach(([label, value], index) => {
    const baseline = 379 + index * 35.5
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor('#707478')
    pdf.setFontSize(11)
    pdf.text(label, 81, baseline)
    pdf.setTextColor('#2D3439')
    fitText(pdf, value, 198, baseline, 303, 11.5)
  })

  pdf.setFillColor('#B4B7B8')
  pdf.roundedRect(52, 532, 472, 81, 13, 13, 'F')
  pdf.setFillColor(BLUE)
  pdf.roundedRect(52, 530, 472, 81, 13, 13, 'F')
  pdf.setTextColor('#FFFFFF')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('MENCIONE ESTE ID AL REGISTRARSE', 288, 555, { align: 'center' })
  pdf.setFontSize(22)
  pdf.text(details.code, 288, 591, { align: 'center' })

  pdf.setTextColor('#0086B5')
  pdf.setFontSize(13)
  pdf.text(['Válido durante 14 días', 'No intercambiable', 'No acumulable'], 288, 648, { align: 'center', lineHeightFactor: 1.2 })
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor('#83888C')
  pdf.setFontSize(9)
  pdf.text('Instituto Mexicano del Cemento y del Concreto A.C.', 288, 706, { align: 'center' })
  return pdf
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
