'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Loader2, LockKeyhole, LogOut, RefreshCw, Search } from 'lucide-react'
import { api, ApiError, errorMessage, getSession } from '@/lib/api'
import { assetPath } from '@/lib/paths'
import { displayDate, serviceGroups, type Registration, type RegistrationResults } from '@/lib/registration'
import { RegistrationDetail } from './RegistrationDetail'

export function AdminPanel() {
  const [username, setUsername] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getSession()
      .then((session) => setUsername(session.authenticated ? session.username : null))
      .catch((error) => setError(errorMessage(error)))
      .finally(() => setChecking(false))
  }, [])

  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-8 lg:px-12">
    <div className="mx-auto max-w-7xl">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <a href={assetPath('/')} aria-label="Volver al registro IMCYC" className="flex items-center gap-4 rounded-md focus-visible:outline-2 focus-visible:outline-cyan-300">
          <img src={assetPath('/logo-imcyc.png')} alt="IMCYC" className="h-12 w-20 object-contain" />
          <span className="border-l border-slate-700 pl-4 font-mono text-[10px] uppercase leading-5 tracking-[0.2em] text-slate-400">Comunidad IMCYC<br /><span className="text-cyan-300">Administración</span></span>
        </a>
        {username && <button className="panel-secondary" onClick={async () => {
          try { await api('logout', { body: {} }); setUsername(null); setError('') }
          catch (error) { setError(errorMessage(error)) }
        }}><LogOut size={15} aria-hidden="true" /> Cerrar sesión</button>}
      </header>
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {checking ? <p role="status" className="py-20 text-center text-slate-400">Comprobando acceso…</p>
        : username ? <Registrations onSessionExpired={() => { setUsername(null); setError('Tu sesión terminó. Ingresa nuevamente.') }} />
          : <Login onLogin={(username) => { setUsername(username); setError('') }} />}
    </div>
  </main>
}

function Login({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const session = await api<{ username: string }>('login', { body: { username, password } })
      setPassword('')
      onLogin(session.username)
    } catch (error) { setError(errorMessage(error)) }
    finally { setSaving(false) }
  }

  return <div className="mx-auto mt-14 max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 sm:mt-24 sm:p-10">
    <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"><LockKeyhole size={22} aria-hidden="true" /></div>
    <h1 className="text-3xl font-bold tracking-tight">Acceso al panel</h1>
    <p className="mb-8 mt-3 text-sm leading-6 text-slate-400">Consulta los datos de contacto, las respuestas y los kits de la comunidad IMCYC.</p>
    <form onSubmit={submit} className="space-y-5">
      <div><label htmlFor="username" className="mb-2 block text-sm font-medium">Usuario</label><input className="panel-input" id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={100} disabled={saving} /></div>
      <div><label htmlFor="password" className="mb-2 block text-sm font-medium">Contraseña</label><input className="panel-input" type="password" id="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={1024} disabled={saving} /></div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button className="panel-action w-full justify-center" disabled={saving}>{saving ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}{saving ? 'Ingresando…' : 'Entrar al panel'}</button>
    </form>
  </div>
}

function Registrations({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [service, setService] = useState('')
  const [query, setQuery] = useState('page=1')
  const [revision, setRevision] = useState(0)
  const [results, setResults] = useState<RegistrationResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Registration | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api<RegistrationResults>('admin.registrations', { query: new URLSearchParams(query), signal: controller.signal })
      .then(setResults)
      .catch((error) => {
        if (controller.signal.aborted) return
        setResults(null)
        if (error instanceof ApiError && error.status === 401) onSessionExpired()
        else setError(errorMessage(error))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
    // El callback solo cambia el acceso; la consulta depende de los filtros y la actualización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, revision])

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(new URLSearchParams({ search: search.trim(), status, service, page: '1' }).toString())
    setRevision((value) => value + 1)
  }

  function changePage(page: number) {
    const nextQuery = new URLSearchParams(query)
    nextQuery.set('page', String(page))
    setQuery(nextQuery.toString())
  }

  const stats = results?.stats
  const pages = results ? Math.max(1, Math.ceil(results.total / results.pageSize)) : 1

  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div><p className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">Directorio de participantes</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Registros de la comunidad</h1><p className="mt-3 text-sm leading-6 text-slate-400">Desde el primer ingreso de datos hasta la encuesta y el kit de continuidad.</p></div>
      <button className="panel-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Actualizar</button>
    </div>
    <dl className="mb-8 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 sm:grid-cols-4">
      {[
        ['Registros totales', stats?.total, 'text-slate-100'],
        ['Solo datos de contacto', stats?.pending, 'text-amber-200'],
        ['Encuestas completas', stats?.completed, 'text-emerald-300'],
        ['Calificación promedio', stats?.averageRating === null ? 'Sin respuestas' : stats ? `${stats.averageRating} / 5` : undefined, 'text-cyan-300'],
      ].map(([label, value, color]) => <div key={label} className="border-r border-slate-800 p-5 last:border-r-0 sm:p-6"><dt className="text-xs leading-5 text-slate-400">{label}</dt><dd className={`mt-2 font-mono text-2xl font-semibold sm:text-3xl ${color}`}>{value ?? '—'}</dd></div>)}
    </dl>
    <section aria-labelledby="list-heading" className="rounded-2xl border border-slate-800 bg-slate-900/50">
      <h2 id="list-heading" className="sr-only">Listado de registros</h2>
      <form onSubmit={applyFilters} className="grid gap-3 border-b border-slate-800 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(230px,1fr)_190px_190px_auto] lg:items-end lg:p-5">
        <div><label className="panel-label" htmlFor="search">Buscar participante</label><input id="search" type="search" className="panel-input" value={search} maxLength={160} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo, empresa o folio" /></div>
        <div><label className="panel-label" htmlFor="status">Estado del registro</label><select id="status" className="panel-input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option><option value="pending">Solo datos de contacto</option><option value="completed">Encuesta completa</option></select></div>
        <div><label className="panel-label" htmlFor="filter-service">Servicio</label><select id="filter-service" className="panel-input" value={service} onChange={(event) => setService(event.target.value)}><option value="">Todos los servicios</option>{Object.entries(serviceGroups).map(([group, services]) => <optgroup key={group} label={group}>{services.map((service) => <option key={service}>{service}</option>)}</optgroup>)}</select></div>
        <button className="panel-action justify-center" disabled={loading}><Search size={16} aria-hidden="true" /> Buscar</button>
      </form>
      {error && <p role="alert" className="m-5 text-sm text-red-300">{error}</p>}
      <div aria-busy={loading}>
        {loading ? <p role="status" className="py-20 text-center text-sm text-slate-400">Cargando registros…</p> : results?.registrations.length ? <>
          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs text-slate-400"><tr>{['Participante', 'Empresa / servicio', 'Estado', 'Fecha de alta', 'Detalle'].map((heading) => <th scope="col" key={heading} className="px-5 py-4 font-medium">{heading}</th>)}</tr></thead>
            <tbody>{results.registrations.map((registration) => <tr key={registration.id} className="border-b border-slate-800/80 last:border-b-0 hover:bg-slate-800/40">
              <td className="max-w-xs px-5 py-5"><p className="break-words font-semibold">{registration.full_name}</p><p className="mt-1 break-all text-xs text-slate-400">{registration.email}</p></td>
              <td className="max-w-56 px-5 py-5"><p className="break-words">{registration.company}</p><p className="mt-1 text-xs text-slate-400">{registration.service || 'Servicio pendiente'}</p></td>
              <td className="px-5 py-5"><RegistrationStatus completed={!!registration.completed_at} /></td>
              <td className="whitespace-nowrap px-5 py-5 font-mono text-xs text-slate-400">{displayDate(registration.created_at)}</td>
              <td className="px-5 py-5"><button className="panel-detail-button" onClick={() => setSelected(registration)} aria-label={`Ver registro de ${registration.full_name}`}>Ver registro <ArrowRight size={14} aria-hidden="true" /></button></td>
            </tr>)}</tbody>
          </table></div>
          <ul className="divide-y divide-slate-800 md:hidden">{results.registrations.map((registration) => <li key={registration.id} className="space-y-3 p-5"><div className="flex flex-wrap justify-between gap-2"><RegistrationStatus completed={!!registration.completed_at} /><time className="font-mono text-[11px] text-slate-400">{displayDate(registration.created_at)}</time></div><div><p className="break-words font-semibold">{registration.full_name}</p><p className="mt-1 break-all text-sm text-slate-400">{registration.email}</p><p className="mt-2 break-words text-sm text-slate-300">{registration.company}</p></div><button className="panel-detail-button" onClick={() => setSelected(registration)} aria-label={`Ver registro de ${registration.full_name}`}>Ver registro <ArrowRight size={14} aria-hidden="true" /></button></li>)}</ul>
        </> : !error && <div className="px-6 py-20 text-center"><p className="font-semibold">{stats?.total ? 'No hay coincidencias con estos filtros' : 'Aún no hay registros'}</p><p className="mt-2 text-sm text-slate-400">{stats?.total ? 'Prueba con otro nombre, estado o servicio.' : 'Los participantes aparecerán aquí en cuanto ingresen sus datos.'}</p></div>}
      </div>
      {results && <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 p-5 text-xs text-slate-400"><p aria-live="polite">{results.total} {results.total === 1 ? 'registro' : 'registros'} · Página {results.page} de {pages}</p><div className="flex gap-2"><button className="panel-secondary" disabled={loading || results.page <= 1} onClick={() => changePage(results.page - 1)}><ArrowLeft size={14} aria-hidden="true" /> Anterior</button><button className="panel-secondary" disabled={loading || results.page >= pages} onClick={() => changePage(results.page + 1)}>Siguiente <ArrowRight size={14} aria-hidden="true" /></button></div></footer>}
    </section>
    <p className="mt-5 text-xs text-slate-400">Las fechas se muestran en horario de Ciudad de México. Los indicadores incluyen todos los registros.</p>
    {selected && <RegistrationDetail registration={selected} onClose={() => setSelected(null)} />}
  </>
}

export function RegistrationStatus({ completed }: { completed: boolean }) {
  return <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${completed ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/25 bg-amber-300/10 text-amber-200'}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${completed ? 'bg-emerald-300' : 'bg-amber-200'}`} />{completed ? 'Encuesta completa' : 'Solo datos de contacto'}</span>
}
