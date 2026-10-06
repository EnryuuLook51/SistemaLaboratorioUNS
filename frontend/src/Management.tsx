import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { api } from './api'
import type { Lab, Reservation } from './types'
import Modal from './Modal'
import { today } from './dates'

export function EditReservation({ code, reservation, labs, onClose, onSaved }: { code: string; reservation: Reservation; labs: Lab[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ laboratorio_id: String(reservation.laboratorio_id), fecha: reservation.fecha, inicio: reservation.inicio, fin: reservation.fin, participantes: String(reservation.participantes) })
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  const selected = labs.find(lab => lab.id === Number(form.laboratorio_id))
  async function save(event: React.FormEvent) {
    event.preventDefault(); setError('')
    if (form.inicio >= form.fin) { setError('El término debe ser posterior al inicio.'); return }
    setSaving(true)
    try {
      await api(`/reservas/${reservation.id}`, code, { method: 'PATCH', body: JSON.stringify({ ...form, laboratorio_id: Number(form.laboratorio_id), participantes: Number(form.participantes) }) })
      onSaved()
    } catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }
  return <Modal title="Modificar reserva" onClose={onClose}><form className="stack-form" onSubmit={save}>
    <p className="muted">{reservation.curso} · solicitud #{reservation.id}</p>
    <label>Laboratorio<select value={form.laboratorio_id} onChange={e => setForm({ ...form, laboratorio_id: e.target.value })}>{labs.filter(lab => lab.activo).map(lab => <option key={lab.id} value={lab.id}>{lab.codigo}</option>)}</select></label>
    <label>Fecha<input required type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} /></label>
    <div className="form-pair"><label>Inicio<input required type="time" value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} /></label><label>Término<input required type="time" value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} /></label></div>
    <label>Participantes<input required type="number" min="1" max={selected?.capacidad} value={form.participantes} onChange={e => setForm({ ...form, participantes: e.target.value })} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button disabled={saving} className="primary">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
  </form></Modal>
}

export function LabForm({ code, lab, onClose, onSaved }: { code: string; lab?: Lab; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const body = { nombre: data.get('nombre'), ubicacion: data.get('ubicacion'), capacidad: Number(data.get('capacidad')), equipos: data.get('equipos'), ...(lab ? { activo: data.get('activo') === 'on' } : { codigo: data.get('codigo') }) }
    setSaving(true); setError('')
    try { await api(lab ? `/laboratorios/${lab.id}` : '/laboratorios', code, { method: lab ? 'PATCH' : 'POST', body: JSON.stringify(body) }); onSaved() }
    catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }
  return <Modal title={lab ? 'Editar laboratorio' : 'Nuevo laboratorio'} onClose={onClose}><form className="stack-form" onSubmit={submit}>
    <label>Código<input name="codigo" required defaultValue={lab?.codigo} disabled={!!lab} placeholder="LAB-D4" /></label>
    <label>Nombre<input name="nombre" required defaultValue={lab?.nombre} placeholder="Laboratorio de Software" /></label>
    <label>Ubicación<input name="ubicacion" required defaultValue={lab?.ubicacion} placeholder="Pabellón D · piso 1" /></label>
    <label>Capacidad<input name="capacidad" type="number" min="1" required defaultValue={lab?.capacidad ?? 30} /></label>
    <label>Equipamiento<input name="equipos" defaultValue={lab?.equipos} placeholder="Computadoras, proyector…" /></label>
    {lab && <label className="checkbox"><input type="checkbox" name="activo" defaultChecked={!!lab.activo} />Disponible para reservas</label>}
    {error && <p className="form-error" role="alert">{error}</p>}<button disabled={saving} className="primary">{saving ? 'Guardando…' : 'Guardar laboratorio'}</button>
  </form></Modal>
}

export function BlockForm({ code, labs, onClose, onSaved }: { code: string; labs: Lab[]; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    if (String(data.get('inicio')) >= String(data.get('fin'))) { setError('El término debe ser posterior al inicio.'); return }
    setSaving(true); setError('')
    try { await api('/bloqueos', code, { method: 'POST', body: JSON.stringify({ laboratorio_id: Number(data.get('laboratorio_id')), fecha: data.get('fecha'), inicio: data.get('inicio'), fin: data.get('fin'), motivo: data.get('motivo') }) }); onSaved() }
    catch (error) { setError((error as Error).message) } finally { setSaving(false) }
  }
  return <Modal title="Bloquear horario" onClose={onClose}><form className="stack-form" onSubmit={submit}><p className="muted">Reserva una franja para mantenimiento. No puede cruzar una clase confirmada.</p>
    <label>Laboratorio<select name="laboratorio_id" required>{labs.filter(lab => lab.activo).map(lab => <option key={lab.id} value={lab.id}>{lab.codigo}</option>)}</select></label>
    <label>Fecha<input name="fecha" type="date" defaultValue={today()} required /></label>
    <div className="form-pair"><label>Inicio<input name="inicio" type="time" defaultValue="08:00" required /></label><label>Término<input name="fin" type="time" defaultValue="09:00" required /></label></div>
    <label>Motivo<input name="motivo" required placeholder="Mantenimiento de equipos" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}<button disabled={saving} className="primary">{saving ? <LoaderCircle className="spin" size={16} /> : 'Guardar bloqueo'}</button>
  </form></Modal>
}
