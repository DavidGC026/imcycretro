import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createKitPdf } from '../lib/kit-pdf.ts'
import { originalKitBenefit } from '../lib/kit-benefit.ts'

const assets = {
  logo: new Uint8Array(await readFile(new URL('../public/logo-imcyc.png', import.meta.url))),
  titleFont: (await readFile(new URL('../public/fonts/Poppins-Bold.ttf', import.meta.url))).toString('base64'),
  subtitleFont: (await readFile(new URL('../public/fonts/Poppins-Medium.ttf', import.meta.url))).toString('base64'),
}
const details = {
  name: 'Participante de ejemplo', company: 'Empresa de ejemplo', service: 'Encuesta IMCYC',
  code: 'EJEMPLO', issuedAt: new Date().toISOString(), benefit: originalKitBenefit, example: true,
}
await mkdir('output/pdf', { recursive: true })
await writeFile('output/pdf/kit-continuidad-imcyc.pdf', new Uint8Array(createKitPdf(details, assets).output('arraybuffer')))
await mkdir('tmp/pdfs', { recursive: true })
await writeFile('tmp/pdfs/kit-nombres-largos.pdf', new Uint8Array(createKitPdf({
  ...details,
  name: 'María Fernanda de los Ángeles Hernández González '.repeat(3).slice(0, 160),
  company: 'Instituto de Investigación y Desarrollo del Cemento y del Concreto, Construcciones y Asociados '.repeat(3).slice(0, 200),
}, assets).output('arraybuffer')))
console.log('PDF de referencia y prueba con nombres extensos generados.')

await writeFile('tmp/pdfs/kit-beneficio-extenso.pdf', new Uint8Array(createKitPdf({
  ...details,
  name: 'María Fernanda de los Ángeles Hernández González '.repeat(3).slice(0, 160),
  company: 'Instituto de Investigación y Desarrollo del Cemento y del Concreto, Construcciones y Asociados '.repeat(3).slice(0, 200),
  benefit: {
    ...originalKitBenefit,
    title: 'BENEFICIO EXCLUSIVO PARA LA COMUNIDAD IMCYC',
    benefit: 'UNA PUBLICACIÓN DIGITAL Y ACCESO A UNA SESIÓN TÉCNICA EXCLUSIVA',
    description: 'Recibe material técnico especializado para aplicar el conocimiento del concreto en tu trabajo y continuar con tu desarrollo profesional.',
    conditions: 'Beneficio personal sujeto a disponibilidad. Solicitar por correo y presentar el folio al registrarse. No se acumula con otras promociones. '.repeat(3).slice(0, 360),
    validityDays: 365,
    email: 'coordinacion-de-capacitacion-y-desarrollo-profesional@example.test',
  },
}, assets).output('arraybuffer')))
