import { useEffect, useState } from 'react'
import { CirclePlus, LoaderCircle, Search, ShieldCheck } from 'lucide-react'
import { api } from './api'
import type { BookingForm, Course, Delegation, Lab, User } from './types'

interface Props {
  code: string; user: User; labs: Lab[]; courses: Course[]; delegations: Delegation[];
  form: BookingForm; setForm: (form: BookingForm) => void; onCreated: () => void
}

export default function Booking({ code, user, labs, courses, delegations, form, setForm, onCreated }: Props) {
  const [available, setAvailable] = useState<Lab[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let ignore = false
    setAvailable(null); setChecking(true); setError('')
    if (!form.fecha || !form.inicio || !form.fin || form.inicio >= form.fin || Number(form.participantes) < 1) {
      setChecking(false)
      return
    }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ fecha: form.fecha, inicio: form.inicio, fin: form.fin, participantes: form.participantes })
      api<Lab[]>(`/disponibilidad?${params}`, code).then(data => { if (!ignore) setAvailable(data) })
        .catch(err => { if (!ignore) setError(err.message) }).finally(() => { if (!ignore) setChecking(false) })
    }, 200)
    return () => { ignore = true; window.clearTimeout(timer) }
  }, [code, form.fecha, form.inicio, form.fin, form.participantes])
  const update = (key: keyof BookingForm, value: string) => {
    const next = { ...form, [key]: value }
    if (key === 'curso_id' && user.rol === 'delegado') next.responsable_id = String(delegations.find(item => item.curso_id === Number(value))?.docente_id ?? '')
    setForm(next)
  }
  const activeLabs = labs.filter(lab => lab.activo)
  const selected = activeLabs.find(lab => lab.id === Number(form.laboratorio_id))
  const selectedAvailable = available?.some(lab => lab.id === Number(form.laboratorio_id))
  const allowedCourses = user.rol === 'delegado' ? courses.filter(course => delegations.some(item => item.curso_id === course.id)) : courses
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('')
    if (form.inicio >= form.fin) { setError('La hora de término debe ser posterior al inicio.'); return }
    setSubmitting(true)
    try {
      await api('/reservas', code, { method: 'POST', body: JSON.stringify({ ...form, laboratorio_id: Number(form.laboratorio_id), curso_id: Number(form.curso_id), participantes: Number(form.participantes), responsable_id: user.rol === 'delegado' ? Number(form.responsable_id) : user.id }) })
      onCreated()
    } catch (err) { setError((err as Error).message) }
    finally { setSubmitting(false) }
  }
  return <section className="panel booking-panel" id="booking">
    <div className="panel-heading"><div><h2><CirclePlus size={21} />Nueva solicitud</h2><p>Un espacio para tu próxima actividad.</p></div></div>
    <form onSubmit={submit} className="booking-form">
      <label>Laboratorio<select required value={form.laboratorio_id} onChange={e => update('laboratorio_id', e.target.value)}><option value="">Seleccionar espacio</option>{activeLabs.map(lab => <option key={lab.id} value={lab.id}>{lab.codigo} · {lab.capacidad} puestos</option>)}</select></label>
      {selected && <div className="field-hint">{selected.ubicacion} · {selected.equipos}</div>}
      <label>Fecha<input required type="date" value={form.fecha} onChange={e => update('fecha', e.target.value)} /></label>
      <div className="form-pair"><label>Inicio<input required type="time" value={form.inicio} onChange={e => update('inicio', e.target.value)} /></label><label>Término<input required type="time" value={form.fin} onChange={e => update('fin', e.target.value)} /></label></div>
      <label>Curso / actividad<select required value={form.curso_id} onChange={e => update('curso_id', e.target.value)}><option value="">Seleccionar curso</option>{allowedCourses.map(course => <option key={course.id} value={course.id}>{course.nombre}</option>)}</select></label>
      {user.rol === 'delegado' && <label>Docente responsable<select required value={form.responsable_id} onChange={e => update('responsable_id', e.target.value)}><option value="">Seleccionar docente</option>{delegations.filter(item => item.curso_id === Number(form.curso_id)).map(item => <option key={item.docente_id} value={item.docente_id}>{item.docente}</option>)}</select></label>}
      <label>Participantes<input required type="number" min="1" max={selected?.capacidad} value={form.participantes} onChange={e => update('participantes', e.target.value)} /></label>
      <div className={`availability-hint ${available && !selectedAvailable && selected ? 'warning' : ''}`} aria-live="polite">{checking ? <><LoaderCircle size={15} className="spin" />Consultando disponibilidad…</> : available ? <><Search size={15} />{selected ? selectedAvailable ? 'Disponible en este horario' : 'Ocupado en este horario. Elige otra franja.' : `${available.length} espacios disponibles`}</> : <><Search size={15} />Completa un horario válido</>}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary full" type="submit" disabled={submitting || checking || !form.laboratorio_id || !form.curso_id || available === null || !selectedAvailable || (user.rol === 'delegado' && !form.responsable_id)}>{submitting ? <><LoaderCircle size={16} className="spin" />Enviando…</> : 'Enviar solicitud'}</button>
      <div className="form-note"><ShieldCheck size={16} /><span>Tu solicitud necesita aprobación. Las reservas confirmadas nunca se superponen.</span></div>
    </form>
  </section>
}
