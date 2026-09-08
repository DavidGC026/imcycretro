import { ApiError } from './api'
import { assetPath } from './paths'

export async function downloadRegistrations(query: URLSearchParams, signal: AbortSignal) {
  const parameters = new URLSearchParams(query)
  parameters.set('action', 'admin.registrations.export')
  parameters.delete('page')
  const response = await fetch(`${assetPath('/api/index.php')}?${parameters}`, {
    credentials: 'same-origin', cache: 'no-store', signal,
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new ApiError(result?.error || 'No pudimos generar el Excel. Intenta nuevamente.', response.status)
  }
  if (!response.headers.get('Content-Type')?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    throw new Error('El servidor no devolvió un archivo Excel. Intenta nuevamente.')
  }
  const file = await response.blob()
  if (signal.aborted) return null
  const filename = response.headers.get('Content-Disposition')?.match(/filename="([a-z0-9-]+\.xlsx)"/i)?.[1] || 'registros-imcyc.xlsx'
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return Number(response.headers.get('X-Export-Count') || 0)
}
