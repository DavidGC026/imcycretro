import { assetPath } from './paths'
import { createKitPdf, type KitDetails, type KitAssets } from './kit-pdf'

let assetsPromise: Promise<KitAssets> | undefined

async function fetchAsset(path: string) {
  const response = await fetch(assetPath(path))
  if (!response.ok) throw new Error('No pudimos cargar el formato del kit. Intenta nuevamente.')
  return new Uint8Array(await response.arrayBuffer())
}

function base64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function loadAssets() {
  assetsPromise ??= Promise.all([
    fetchAsset('/logo-imcyc.png'), fetchAsset('/fonts/Poppins-Bold.ttf'), fetchAsset('/fonts/Poppins-Medium.ttf'),
  ]).then(([logo, title, subtitle]) => ({ logo, titleFont: base64(title), subtitleFont: base64(subtitle) }))
    .catch((error) => { assetsPromise = undefined; throw error })
  return assetsPromise
}

export async function downloadKit(details: KitDetails) {
  const pdf = createKitPdf(details, await loadAssets())
  pdf.save(`kit-continuidad-${details.code}.pdf`)
}
