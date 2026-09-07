'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { KeyRound, Loader2, RefreshCw, UserPlus, X } from 'lucide-react'
import { api, ApiError, errorMessage } from '@/lib/api'
import { displayDate } from '@/lib/registration'

type Administrator = { id: number; username: string; created_at: string; isCurrent: boolean }
type PasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string }
const emptyPasswords: PasswordValues = { currentPassword: '', newPassword: '', confirmPassword: '' }

export function UserManagement({ username, onSessionExpired }: { username: string; onSessionExpired: () => void }) {
  const [users, setUsers] = useState<Administrator[]>([])
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<Administrator | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api<{ users: Administrator[] }>('admin.users', { signal: controller.signal })
      .then(({ users }) => setUsers(users))
      .catch((error) => {
        if (controller.signal.aborted) return
        setUsers([])
        if (error instanceof ApiError && error.status === 401) onSessionExpired()
        else setError(errorMessage(error))
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision, onSessionExpired])

  return <section aria-labelledby="users-title">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">Administración de acceso</p><h1 id="users-title" className="text-3xl font-bold tracking-tight sm:text-4xl">Usuarios del panel</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Crea cuentas para tu equipo y actualiza sus contraseñas. Todos estos usuarios pueden consultar los registros y administrar el acceso al panel.</p></div>
      <button type="button" className="panel-secondary" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Actualizar usuarios</button>
    </div>
    {notice && <p role="status" className="mb-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">{notice}</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50" aria-busy={loading}>
        <h2 className="border-b border-slate-800 px-5 py-4 text-sm font-semibold">Usuarios administradores{!loading && <span className="ml-2 font-mono text-xs font-normal text-slate-400">({users.length})</span>}</h2>
        {error && <p role="alert" className="p-5 text-sm text-red-300">{error}</p>}
        {loading ? <p role="status" className="px-5 py-14 text-center text-sm text-slate-400">Cargando usuarios…</p> : <ul className="divide-y divide-slate-800">
          {users.map((user) => <li key={user.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-all font-semibold">{user.username}</p>{user.isCurrent && <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">Tu cuenta</span>}</div><p className="mt-1 text-xs text-slate-400">Creado el {displayDate(user.created_at)}</p></div>
            <button type="button" className="panel-secondary" onClick={() => { setSelected(user); setNotice('') }} aria-label={user.isCurrent ? 'Cambiar mi contraseña' : `Cambiar contraseña de ${user.username}`}><KeyRound size={15} aria-hidden="true" />{user.isCurrent ? 'Cambiar mi contraseña' : 'Cambiar contraseña'}</button>
          </li>)}
        </ul>}
      </div>
      <CreateUser currentUsername={username} onSessionExpired={onSessionExpired} onCreated={(createdUsername) => {
        setNotice(`Usuario ${createdUsername} creado. Ya puede ingresar al panel con su contraseña.`)
        setRevision((value) => value + 1)
      }} />
    </div>
    {selected && <ChangePassword user={selected} currentUsername={username} onSessionExpired={onSessionExpired} onClose={() => setSelected(null)} onChanged={(changedUsername) => {
      setSelected(null)
      setNotice(`Contraseña de ${changedUsername} actualizada. Las demás sesiones de esa cuenta se cerraron.`)
    }} />}
  </section>
}

function CreateUser({ currentUsername, onCreated, onSessionExpired }: { currentUsername: string; onCreated: (username: string) => void; onSessionExpired: () => void }) {
  const [username, setUsername] = useState('')
  const [passwords, setPasswords] = useState(emptyPasswords)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    if (passwords.newPassword !== passwords.confirmPassword) { setError('Las contraseñas nuevas no coinciden.'); return }
    setSaving(true)
    setError('')
    try {
      const result = await api<{ username: string }>('admin.users.create', { body: { username, ...passwords } })
      setUsername('')
      setPasswords(emptyPasswords)
      onCreated(result.username)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired()
      else setError(errorMessage(error))
    } finally { setSaving(false) }
  }

  return <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6" aria-labelledby="create-user-title">
    <h2 id="create-user-title" className="flex items-center gap-2 text-lg font-semibold"><UserPlus size={19} className="text-cyan-300" aria-hidden="true" /> Crear usuario</h2>
    <fieldset disabled={saving} className="mt-6 space-y-5">
      <div><label htmlFor="new-username" className="panel-label">Nombre de usuario</label><input id="new-username" className="panel-input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={100} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,99}" aria-describedby="username-help" /><p id="username-help" className="mt-2 text-xs leading-5 text-slate-400">De 3 a 100 caracteres. Usa letras, números, puntos o guiones.</p></div>
      <PasswordFields prefix="create" values={passwords} onChange={setPasswords} currentUsername={currentUsername} />
    </fieldset>
    {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    <button type="submit" disabled={saving} className="panel-action mt-6 w-full justify-center">{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}{saving ? 'Creando usuario…' : 'Crear usuario'}</button>
  </form>
}

function ChangePassword({ user, currentUsername, onChanged, onClose, onSessionExpired }: { user: Administrator; currentUsername: string; onChanged: (username: string) => void; onClose: () => void; onSessionExpired: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [passwords, setPasswords] = useState(emptyPasswords)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const dialog = dialogRef.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    if (passwords.newPassword !== passwords.confirmPassword) { setError('Las contraseñas nuevas no coinciden.'); return }
    setSaving(true)
    setError('')
    try {
      const result = await api<{ username: string }>('admin.users.password', { body: { id: user.id, ...passwords } })
      setPasswords(emptyPasswords)
      onChanged(result.username)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired()
      else setError(errorMessage(error))
    } finally { setSaving(false) }
  }

  return <dialog ref={dialogRef} aria-labelledby="password-title" onCancel={(event) => { event.preventDefault(); if (!saving) onClose() }} onClick={(event) => { if (!saving && event.target === dialogRef.current) onClose() }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl backdrop:bg-black/70 sm:p-8">
    <div className="flex items-start justify-between gap-4"><h2 id="password-title" className="text-2xl font-bold">{user.isCurrent ? 'Cambiar mi contraseña' : 'Cambiar contraseña'}</h2><button type="button" disabled={saving} onClick={onClose} className="panel-secondary shrink-0 p-2" aria-label="Cerrar cambio de contraseña"><X size={18} aria-hidden="true" /></button></div>
    <p className="mt-3 break-words text-sm leading-6 text-slate-400">Cuenta: <strong className="text-slate-200">{user.username}</strong>. {user.isCurrent ? 'Esta sesión seguirá abierta. Las demás sesiones de tu cuenta perderán acceso.' : 'Las sesiones de este usuario perderán acceso y deberá ingresar con la nueva contraseña.'}</p>
    <form onSubmit={submit} className="mt-6">
      <fieldset disabled={saving} className="space-y-5"><PasswordFields prefix="change" values={passwords} onChange={setPasswords} currentUsername={currentUsername} /></fieldset>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" className="panel-secondary" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="panel-action" disabled={saving}>{saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{saving ? 'Guardando…' : 'Guardar contraseña'}</button></div>
    </form>
  </dialog>
}

function PasswordFields({ prefix, values, onChange, currentUsername }: { prefix: string; values: PasswordValues; onChange: (values: PasswordValues) => void; currentUsername: string }) {
  return <>
    <div><label htmlFor={`${prefix}-new-password`} className="panel-label">Nueva contraseña</label><input id={`${prefix}-new-password`} type="password" className="panel-input" autoComplete="new-password" required minLength={12} maxLength={128} value={values.newPassword} onChange={(event) => onChange({ ...values, newPassword: event.target.value })} aria-describedby={`${prefix}-password-help`} /><p id={`${prefix}-password-help`} className="mt-2 text-xs leading-5 text-slate-400">Entre 12 y 128 caracteres. Puedes usar una frase con espacios.</p></div>
    <div><label htmlFor={`${prefix}-confirm-password`} className="panel-label">Confirmar nueva contraseña</label><input id={`${prefix}-confirm-password`} type="password" className="panel-input" autoComplete="new-password" required minLength={12} maxLength={128} value={values.confirmPassword} onChange={(event) => onChange({ ...values, confirmPassword: event.target.value })} /></div>
    <div className="border-t border-slate-700 pt-5"><label htmlFor={`${prefix}-current-password`} className="panel-label">Tu contraseña actual</label><input id={`${prefix}-current-password`} type="password" className="panel-input" autoComplete="current-password" required maxLength={1024} value={values.currentPassword} onChange={(event) => onChange({ ...values, currentPassword: event.target.value })} aria-describedby={`${prefix}-current-help`} /><p id={`${prefix}-current-help`} className="mt-2 break-words text-xs leading-5 text-slate-400">Confirma el cambio con la contraseña de tu cuenta: {currentUsername}.</p></div>
  </>
}
