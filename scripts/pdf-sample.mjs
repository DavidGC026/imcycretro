import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createKitPdf } from '../lib/kit-pdf.ts'

const assets = {
  logo: new Uint8Array(await readFile(new URL('../public/logo-imcyc.png', import.meta.url))),
  titleFont: (await readFile(new URL('../public/fonts/Poppins-Bold.ttf', import.meta.url))).toString('base64'),
  subtitleFont: (await readFile(new URL('../public/fonts/Poppins-Medium.ttf', import.meta.url))).toString('base64'),
}
const details = {
  name: 'Prueba', company: 'IMCYC', service: 'Certificación',
  code: 'IMCYC-8630C9FF2BAD16A4', issuedAt: '2026-09-07T18:00:00Z',
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
