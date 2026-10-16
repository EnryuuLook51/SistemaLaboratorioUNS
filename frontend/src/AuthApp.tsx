import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import App from './App'
import Login from './Login'
import { api, ApiError } from './api'
import type { User } from './types'

export default function AuthApp() {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let ignore = false
    setChecking(true); setError('')
    api<User>('/usuarios/me').then(user => { if (!ignore) setUser(user) })
      .catch(error => { if (!ignore && (!(error instanceof ApiError) || error.status !== 401)) setError(error.message) })
      .finally(() => { if (!ignore) setChecking(false) })
    return () => { ignore = true }
  }, [revision])

  useEffect(() => {
    const expire = () => { setUser(null); if (user) setNotice('Tu sesión venció. Inicia sesión para continuar.') }
    window.addEventListener('uns-session-expired', expire)
    // Limpiar únicamente la preferencia del selector antiguo, no otros datos del navegador.
    localStorage.removeItem('uns-demo-user')
    return () => window.removeEventListener('uns-session-expired', expire)
  }, [user])

  if (checking || error) return <main className="auth-loading" aria-live="polite">{checking ? <><LoaderCircle size={28} className="spin" /><p>Comprobando tu sesión…</p></> : <><h1>No pudimos conectar</h1><p role="alert">{error}</p><button className="primary" onClick={() => setRevision(value => value + 1)}>Reintentar</button></>}</main>
  if (!user) return <Login notice={notice} onLogin={user => { setUser(user); setNotice('') }} />
  return <App key={user.id} sessionUser={user} onLogout={() => { setUser(null); setNotice('Sesión cerrada correctamente.') }} />
}
