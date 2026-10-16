import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, Eye, EyeOff, GraduationCap, LockKeyhole, Monitor, ShieldCheck } from 'lucide-react'
import { api } from './api'
import type { User } from './types'

export default function Login({ notice, onLogin }: { notice: string; onLogin: (user: User) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const user = await api<User>('/auth/login', { method: 'POST', body: JSON.stringify({ identificador: identifier.trim(), password }) })
      onLogin(user)
    } catch (error) { setError((error as Error).message) }
    finally { setBusy(false) }
  }

  return <main className="login-page">
    <section className="login-story" aria-label="UNS Espacios">
      <div className="brand"><GraduationCap size={30} strokeWidth={1.8} /><span>UNS <b>·</b> ESPACIOS</span></div>
      <div className="login-story-content"><span className="login-kicker">TU CAMPUS, MEJOR ORGANIZADO</span><h2>Un espacio para<br />lo que viene.</h2><p>Consulta horarios, reserva un laboratorio y concentra tu tiempo en lo importante.</p>
        <div className="login-preview" aria-hidden="true"><div className="login-preview-heading"><CalendarDays size={19} /><span>Una semana de posibilidades</span><span className="status-dot" /></div><div className="login-preview-grid"><span>08:00</span><div className="login-preview-event"><Monitor size={21} /><div><strong>Laboratorio de Informática</strong><small>Clases, ideas y nuevos proyectos</small></div><Check size={17} /></div><span>10:00</span><div className="login-preview-free">Tu próxima actividad empieza aquí</div></div><div className="login-preview-footer"><ShieldCheck size={14} />Horarios claros. Reservas sin cruces.</div></div>
      </div><small className="login-campus">UNIVERSIDAD NACIONAL DEL SANTA <span>Campus central · 2026</span></small>
    </section>
    <section className="login-access" aria-labelledby="login-title"><div className="login-card"><span className="login-lock"><LockKeyhole size={23} strokeWidth={1.7} /></span><div className="eyebrow">SERVICIOS ACADÉMICOS</div><h1 id="login-title">Bienvenido de nuevo</h1><p className="login-intro">Ingresa a tu cuenta para gestionar tus espacios.</p>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="identifier">Código institucional o correo</label><input id="identifier" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="Ej. DOC001 o tu correo UNS" value={identifier} onChange={e => setIdentifier(e.target.value)} disabled={busy} />
        <label htmlFor="password">Contraseña</label><div className="login-password"><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={256} placeholder="Ingresa tu contraseña" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /><button className="icon-button" type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
        {error ? <p className="form-error" role="alert">{error}</p> : notice && <p className="login-notice" role="status">{notice}</p>}
        <button className="primary full login-submit" disabled={busy || !identifier.trim()} type="submit">{busy ? 'Ingresando…' : 'Iniciar sesión'}<ArrowRight size={17} /></button>
      </form><div className="login-security"><ShieldCheck size={16} /><span>Acceso personal. Tus permisos dependen de tu rol.</span></div>
      <details className="login-demo"><summary>¿Estás probando la aplicación?</summary><p>Usa <strong>DOC001</strong> (docente), <strong>DEL001</strong> (delegado), <strong>ADM001</strong> (administrador) o <strong>COO001</strong> (coordinador).</p><p>Contraseña inicial de ejemplo: <code>Uns2026!</code>. No son cuentas institucionales reales.</p></details>
    </div><footer className="login-access-footer">UNS · Gestión de laboratorios</footer></section>
  </main>
}
