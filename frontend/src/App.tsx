import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BarChart3, Bell, Building2, CalendarDays, Check, ChevronRight, ClipboardCheck, GraduationCap, HelpCircle, Info, LoaderCircle, MapPin, Monitor, Plus, RefreshCw, Search, ShieldCheck, Users, X } from 'lucide-react'
import { api } from './api'
import Calendar from './Calendar'
import Booking from './Booking'
import Modal from './Modal'
import { BlockForm, EditReservation, LabForm } from './Management'
import { monday, plusDays, shortDate, today } from './dates'
import type { Block, BookingForm, Course, Delegation, Lab, Notification, Reservation, Schedule, ScheduleReservation, Status, Usage, User } from './types'

type View = 'agenda' | 'laboratorios' | 'solicitudes' | 'reportes'
interface Data { user: User; labs: Lab[]; courses: Course[]; reservations: Reservation[]; schedule: Schedule; delegations: Delegation[]; notifications: Notification[]; usage: Usage[] }
const roles = { docente: 'Docente', delegado: 'Delegado de curso', administrador: 'Administrador', coordinador: 'Coordinador académico' }
const labels: Record<Status, string> = { pendiente: 'Pendiente', confirmada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada' }
const demoUsers = [{ code: 'DOC001', name: 'María Torres · Docente' }, { code: 'DEL001', name: 'Luis Vega · Delegado' }, { code: 'ADM001', name: 'Ana Rojas · Administrador' }, { code: 'COO001', name: 'Elena Paz · Coordinador' }]
const initialForm = (): BookingForm => ({ laboratorio_id: '', curso_id: '', responsable_id: '', fecha: today(), inicio: '09:00', fin: '11:00', participantes: '24' })
function Badge({ status }: { status: Status }) { return <span className={`badge ${status}`}>{labels[status]}</span> }

export default function App() {
  const [code, setCode] = useState(() => localStorage.getItem('uns-demo-user') || 'DOC001')
  const [view, setView] = useState<View>('agenda')
  const [week, setWeek] = useState(monday(today()))
  const [revision, setRevision] = useState(0)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [labFilter, setLabFilter] = useState('')
  const [capacity, setCapacity] = useState('')
  const [equipment, setEquipment] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState<BookingForm>(initialForm)
  const [detail, setDetail] = useState<ScheduleReservation | Block | Reservation | null>(null)
  const [editing, setEditing] = useState<Reservation | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [labEditing, setLabEditing] = useState<Lab | 'new' | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const currentCode = useRef(code); currentCode.current = code

  useEffect(() => {
    let ignore = false
    setLoading(true); setError('')
    async function load() {
      try {
        const user = await api<User>('/usuarios/me', code)
        const privileged = ['administrador', 'coordinador'].includes(user.rol)
        const [labs, courses, reservations, schedule, delegations, notifications, usage] = await Promise.all([
          api<Lab[]>(`/laboratorios${privileged ? '?incluir_inactivos=true' : ''}`, code),
          api<Course[]>('/cursos', code), api<Reservation[]>('/reservas', code),
          api<Schedule>(`/agenda?desde=${week}&hasta=${plusDays(week, 6)}`, code),
          user.rol === 'delegado' ? api<Delegation[]>('/autorizaciones-curso', code) : Promise.resolve([] as Delegation[]),
          api<Notification[]>('/notificaciones', code), privileged ? api<Usage[]>('/reportes/uso', code) : Promise.resolve([] as Usage[]),
        ])
        if (!ignore) setData({ user, labs, courses, reservations, schedule, delegations, notifications, usage })
      } catch (error) { if (!ignore) setError((error as Error).message) }
      finally { if (!ignore) setLoading(false) }
    }
    void load()
    return () => { ignore = true }
  }, [code, week, revision])

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer) }, [toast])
  function changeCode(value: string) {
    setCode(value); localStorage.setItem('uns-demo-user', value); setData(null); setLoading(true)
    setView('agenda'); setDetail(null); setEditing(null); setCancelTarget(null); setLabEditing(null); setNotificationsOpen(false); setBlockOpen(false); setForm(initialForm()); setError('')
  }
  function refresh(message?: string) { setRevision(value => value + 1); if (message) setToast(message) }
  async function action(reservation: Reservation, command: string) {
    const requestCode = code
    setBusy(true); setError('')
    try {
      await api(`/reservas/${reservation.id}/${command}`, requestCode, { method: 'POST' })
      if (requestCode === currentCode.current) { setDetail(null); setCancelTarget(null); refresh(command === 'aprobar' ? 'Reserva confirmada. El horario ya está guardado.' : command === 'rechazar' ? 'Solicitud rechazada.' : 'Reserva cancelada.'); }
    } catch (error) { if (requestCode === currentCode.current) { setError((error as Error).message); setCancelTarget(null) } }
    finally { setBusy(false) }
  }
  const user = data?.user
  const admin = user?.rol === 'administrador'
  const privileged = admin || user?.rol === 'coordinador'
  const canBook = user?.rol === 'docente' || user?.rol === 'delegado'
  const labs = data?.labs ?? []
  const matchingLabIds = new Set(labs.filter(lab => (!labFilter || lab.id === Number(labFilter)) && (!capacity || lab.capacidad >= Number(capacity)) && (!equipment || lab.equipos.toLowerCase().includes(equipment))).map(lab => lab.id))
  const schedule: Schedule = { reservas: (data?.schedule.reservas ?? []).filter(item => matchingLabIds.has(item.laboratorio_id)), bloqueos: (data?.schedule.bloqueos ?? []).filter(item => matchingLabIds.has(item.laboratorio_id)) }
  const pending = (data?.reservations ?? []).filter(item => item.estado === 'pendiente')
  const visibleRequests = (data?.reservations ?? []).filter(item => (!statusFilter || item.estado === statusFilter) && `${item.laboratorio} ${item.curso} ${item.responsable}`.toLowerCase().includes(query.toLowerCase()))
  const visibleLabs = labs.filter(lab => `${lab.codigo} ${lab.nombre} ${lab.ubicacion} ${lab.equipos}`.toLowerCase().includes(query.toLowerCase()))
  const ownDetail = detail && 'estado' in detail ? data?.reservations.find(item => item.id === detail.id) : undefined
  const canModify = (reservation: Reservation) => privileged || (user?.rol === 'docente' && reservation.responsable_id === user.id)
  const activeStatus = (reservation: Reservation) => ['pendiente', 'confirmada'].includes(reservation.estado)
  const nav = [{ id: 'agenda' as View, name: 'Reservas', icon: CalendarDays }, { id: 'laboratorios' as View, name: 'Laboratorios', icon: Building2 }, { id: 'solicitudes' as View, name: privileged ? 'Solicitudes' : 'Mis solicitudes', icon: ClipboardCheck }, ...(privileged ? [{ id: 'reportes' as View, name: 'Reportes', icon: BarChart3 }] : [])]
  const title = view === 'agenda' ? 'Reserva de laboratorios' : view === 'laboratorios' ? 'Espacios del campus' : view === 'solicitudes' ? privileged ? 'Gestión de solicitudes' : 'Mis solicitudes' : 'Uso de laboratorios'

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setView('agenda') }}><GraduationCap size={30} strokeWidth={1.8} /><span>UNS <b>·</b> ESPACIOS</span></a>
      <div className="nav-caption">GESTIÓN DE LABORATORIOS</div>
      <nav aria-label="Navegación principal">{nav.map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'selected' : ''}`} aria-current={view === item.id ? 'page' : undefined} onClick={() => { setView(item.id); setQuery('') }}><item.icon size={20} strokeWidth={1.7} /><span>{item.name}</span>{item.id === 'solicitudes' && pending.length > 0 && <em>{pending.length}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><button className="help-card" onClick={() => setHelpOpen(true)}><span><HelpCircle size={19} />¿Necesitas ayuda?</span><small>Reglas de uso, permisos y pruebas.</small><ChevronRight size={16} className="help-arrow" /></button><div className="campus-footer">UNIVERSIDAD NACIONAL DEL SANTA<small>Campus central · 2026</small></div></div>
    </aside>
    <main className="main-area">
      <header className="page-header"><div><div className="eyebrow">SERVICIOS ACADÉMICOS <span>/</span> CAMPUS CENTRAL</div><h1>{title}</h1><p>{view === 'agenda' ? 'Consulta disponibilidad y organiza tus próximas actividades.' : view === 'laboratorios' ? 'Conoce la capacidad y el equipamiento de cada espacio.' : view === 'solicitudes' ? 'Sigue cada solicitud, desde el registro hasta su confirmación.' : 'Reservas confirmadas por espacio, con datos de la base actual.'}</p></div><div className="header-actions"><button className="icon-button notifications-button" aria-label="Ver notificaciones" onClick={() => setNotificationsOpen(true)}><Bell size={21} />{!!data?.notifications.length && <i>{data.notifications.length}</i>}</button><span className="avatar" title={user?.nombre}>{user?.nombre.split(' ').map(word => word[0]).slice(0, 2).join('') || 'U'}</span></div></header>
      <div className="demo-bar"><span><ShieldCheck size={15} /><strong>Prueba local</strong><span className="demo-description">Cambia de perfil para recorrer el flujo completo.</span></span><label className="profile-switch"><span>Perfil</span><select aria-label="Perfil de demostración" value={code} disabled={busy} onChange={e => changeCode(e.target.value)}>{demoUsers.map(person => <option key={person.code} value={person.code}>{person.name}</option>)}</select></label></div>
      {error && <div className="error-banner" role="alert"><Info size={18} /><div><strong>No pudimos completar la operación</strong><p>{error}</p></div><button className="quiet" onClick={() => refresh()}>Reintentar</button></div>}
      {!data ? <div className="initial-loading">{loading ? <><LoaderCircle className="spin" size={28} /><h2>Preparando tus espacios…</h2><p>Cargando agenda y catálogos desde SQLite.</p></> : <><Building2 size={32} /><h2>La aplicación espera al backend</h2><p>Ejecuta <code>./start.sh</code> desde app para iniciar el sistema.</p><button className="primary" onClick={() => refresh()}>Volver a conectar</button></>}</div> : <>
        {view === 'agenda' && <>
          <section className="filter-bar" aria-label="Filtros de agenda"><label className="date-filter"><CalendarDays size={19} /><input aria-label="Fecha de la agenda" type="date" value={week} onChange={e => { if (e.target.value) setWeek(monday(e.target.value)) }} /></label><label>LABORATORIO<select aria-label="Filtrar laboratorio" value={labFilter} onChange={e => setLabFilter(e.target.value)}><option value="">Todos los espacios</option>{labs.map(lab => <option key={lab.id} value={lab.id}>{lab.codigo}</option>)}</select></label><label>CAPACIDAD<select aria-label="Filtrar capacidad" value={capacity} onChange={e => setCapacity(e.target.value)}><option value="">Cualquier tamaño</option><option value="24">24+ participantes</option><option value="30">30+ participantes</option><option value="36">36+ participantes</option></select></label><label>EQUIPAMIENTO<select aria-label="Filtrar equipamiento" value={equipment} onChange={e => setEquipment(e.target.value)}><option value="">Todo el equipamiento</option><option value="computadoras">Computadoras</option><option value="proyector">Proyector</option><option value="redes">Redes</option></select></label><button className="icon-button" disabled={loading} aria-label="Actualizar agenda" onClick={() => refresh()}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button></section>
          <div className="agenda-layout"><Calendar week={week} schedule={schedule} onWeek={date => setWeek(monday(date))} onEvent={setDetail} onSlot={(fecha, inicio, fin) => { if (canBook) { setForm({ ...form, fecha, inicio, fin, ...(labFilter ? { laboratorio_id: labFilter } : {}) }); document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) } else setToast('Elige “Bloquear horario” para registrar mantenimiento o selecciona una reserva.') }} />
            <aside className="agenda-side">{canBook && <Booking code={code} user={data.user} labs={labs} courses={data.courses} delegations={data.delegations} form={form} setForm={setForm} onCreated={() => refresh('Solicitud enviada. La verás en “Mis solicitudes”.')} />}
              {privileged && <section className="panel"><div className="panel-heading"><div><h2><ClipboardCheck size={20} />Por aprobar</h2><p>{pending.length ? `${pending.length} solicitudes necesitan revisión` : 'Todas las solicitudes están al día'}</p></div><span className="badge pendiente">{pending.length.toString().padStart(2, '0')}</span></div><div className="queue">{pending.slice(0, 3).map(reservation => <article key={reservation.id}><button className="queue-title" onClick={() => setDetail(reservation)}>{labs.find(lab => lab.id === reservation.laboratorio_id)?.codigo}<ArrowUpRight size={14} /></button><p>{reservation.curso}</p><small>{shortDate(reservation.fecha)} · {reservation.inicio}–{reservation.fin}</small>{admin && <div className="queue-actions"><button disabled={busy} className="approve-button" onClick={() => action(reservation, 'aprobar')}><Check size={13} />Aprobar</button><button disabled={busy} className="quiet" onClick={() => action(reservation, 'rechazar')}>Rechazar</button></div>}</article>)}{!pending.length && <div className="mini-empty"><Check size={24} /><p>Sin pendientes por ahora.</p></div>}<button className="text-link" onClick={() => { setView('solicitudes'); setStatusFilter('pendiente') }}>Ver solicitudes <ChevronRight size={14} /></button></div></section>}
              {admin && <button className="secondary full" onClick={() => setBlockOpen(true)}><Plus size={16} />Bloquear horario</button>}
              <section className="panel summary-panel"><div className="panel-heading"><div><h2>Esta semana</h2><p>Programación confirmada en el campus</p></div></div><div className="summary-number">{schedule.reservas.length}<span>reservas confirmadas</span></div><div className="summary-pairs"><span><Building2 size={15} />{labs.filter(lab => lab.activo).length} espacios activos</span><span><ShieldCheck size={15} />{schedule.bloqueos.length} bloqueos</span></div><div className="summary-footer"><span className="status-dot" />Datos del backend · {roles[data.user.rol]}</div></section>
            </aside>
          </div>
        </>}
        {view === 'solicitudes' && <section className="panel requests-panel"><div className="panel-heading"><div><h2>{privileged ? 'Solicitudes del campus' : 'Tus actividades'}</h2><p>{data.reservations.length} registros · {pending.length} pendientes</p></div><button className="icon-button" disabled={loading} aria-label="Actualizar solicitudes" onClick={() => refresh()}><RefreshCw size={17} /></button></div><div className="list-filters"><label className="search-box"><Search size={17} /><input placeholder="Buscar curso o laboratorio" aria-label="Buscar solicitudes" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Estado de solicitudes" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="">Todos los estados</option>{Object.entries(labels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></div><div className="table-scroll"><table><thead><tr><th>ACTIVIDAD / ESPACIO</th><th>FECHA Y HORARIO</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{visibleRequests.map(reservation => <tr key={reservation.id}><td><button className="table-title" onClick={() => setDetail(reservation)}>{reservation.curso}</button><small>{labs.find(lab => lab.id === reservation.laboratorio_id)?.codigo} · {reservation.participantes} participantes{privileged ? ` · ${reservation.responsable}` : ''}</small></td><td>{shortDate(reservation.fecha)}<small>{reservation.inicio}–{reservation.fin}</small></td><td><Badge status={reservation.estado} /></td><td><div className="row-actions">{admin && reservation.estado === 'pendiente' && <><button disabled={busy} className="approve-button" onClick={() => action(reservation, 'aprobar')}>Aprobar</button><button disabled={busy} className="quiet" onClick={() => action(reservation, 'rechazar')}>Rechazar</button></>}{canModify(reservation) && activeStatus(reservation) && <><button disabled={busy} className="quiet" onClick={() => setEditing(reservation)}>Editar</button><button disabled={busy} className="quiet danger-text" onClick={() => setCancelTarget(reservation)}>Cancelar</button></>}{(!canModify(reservation) || !activeStatus(reservation)) && <button className="quiet" onClick={() => setDetail(reservation)}>Ver detalle</button>}</div></td></tr>)}</tbody></table></div>{!visibleRequests.length && <div className="empty-state"><ClipboardCheck size={30} /><h3>No hay solicitudes que mostrar</h3><p>{data.reservations.length ? 'Prueba otro filtro o término de búsqueda.' : 'Cuando registres una solicitud, aparecerá aquí.'}</p>{canBook && <button className="primary" onClick={() => setView('agenda')}>Ir a la agenda</button>}</div>}</section>}
        {view === 'laboratorios' && <><div className="list-toolbar"><label className="search-box"><Search size={17} /><input placeholder="Buscar nombre, ubicación o equipos" aria-label="Buscar laboratorios" value={query} onChange={e => setQuery(e.target.value)} /></label>{admin && <button className="primary" onClick={() => setLabEditing('new')}><Plus size={17} />Nuevo laboratorio</button>}</div><div className="labs-grid">{visibleLabs.map((lab, i) => <article className="panel lab-card" key={lab.id}><div className={`lab-illustration tone-${i % 3}`}><Monitor size={74} strokeWidth={1.1} /><span>{lab.codigo}</span><span className={`badge ${lab.activo ? 'confirmada' : 'cancelada'}`}>{lab.activo ? 'Activo' : 'Inactivo'}</span></div><div className="lab-body"><h2>{lab.nombre}</h2><p><MapPin size={14} />{lab.ubicacion}</p><div className="lab-features"><span><Users size={16} />{lab.capacidad} participantes</span><span><Monitor size={16} />{lab.equipos || 'Sin detalle de equipos'}</span></div><div className="lab-footer"><span className={`lab-state ${lab.activo ? '' : 'inactive'}`}><i />{lab.activo ? 'En servicio' : 'Fuera de servicio'}</span>{admin ? <button className="text-link" onClick={() => setLabEditing(lab)}>Editar espacio<ChevronRight size={14} /></button> : <button className="text-link" onClick={() => { setLabFilter(String(lab.id)); setForm({ ...form, laboratorio_id: String(lab.id) }); setView('agenda') }}>Ver horario<ChevronRight size={14} /></button>}</div></div></article>)}</div>{!visibleLabs.length && <div className="empty-state"><Building2 size={30} /><h3>No encontramos espacios</h3><p>Prueba otra búsqueda.</p></div>}</>}
        {view === 'reportes' && privileged && <section className="panel report-panel"><div className="panel-heading"><div><h2>Reservas confirmadas por laboratorio</h2><p>Conteo histórico de reservas que siguen confirmadas.</p></div><span className="badge confirmada">{data.usage.reduce((total, item) => total + item.reservas_confirmadas, 0)} confirmadas</span></div><div className="usage-list">{data.usage.map(item => <div key={item.id} className="usage-row"><div><strong>{item.codigo}</strong><span>{item.nombre}</span></div><div className="usage-track"><i style={{ width: `${item.reservas_confirmadas / Math.max(1, ...data.usage.map(row => row.reservas_confirmadas)) * 100}%` }} /></div><b>{item.reservas_confirmadas}</b></div>)}</div><div className="calendar-note"><Info size={16} />Los datos se actualizan al aprobar, cancelar o rechazar reservas.</div></section>}
      </>}
      <footer className="page-footer"><span>UNS · Servicios académicos</span><span>{loading && data ? 'Actualizando…' : 'Reservas, clases y actividades'}</span></footer>
    </main>
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="Cerrar aviso"><X size={15} /></button></div>}
    {detail && <Modal title={'motivo' in detail ? 'Horario bloqueado' : 'Detalle de reserva'} onClose={() => setDetail(null)}><div className="detail-top"><span className="lab-icon"><Building2 size={24} /></span><div><h3>{detail.laboratorio}</h3><p>{'curso' in detail ? detail.curso : detail.motivo}</p></div></div><dl className="detail-list"><dt>Fecha</dt><dd>{shortDate(detail.fecha)}</dd><dt>Horario</dt><dd>{detail.inicio}–{detail.fin}</dd>{'participantes' in detail && <><dt>Participantes</dt><dd>{detail.participantes}</dd><dt>Estado</dt><dd><Badge status={ownDetail?.estado ?? detail.estado} /></dd></>}{ownDetail && <><dt>Responsable</dt><dd>{ownDetail.responsable}</dd><dt>Solicitante</dt><dd>{ownDetail.solicitante}</dd></>}</dl>{ownDetail && canModify(ownDetail) && activeStatus(ownDetail) && <div className="modal-actions"><button className="secondary" onClick={() => { setEditing(ownDetail); setDetail(null) }}>Modificar</button><button className="quiet danger-text" onClick={() => { setCancelTarget(ownDetail); setDetail(null) }}>Cancelar reserva</button></div>}</Modal>}
    {editing && <EditReservation code={code} reservation={editing} labs={labs} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh('Reserva actualizada.') }} />}
    {cancelTarget && <Modal title="Cancelar reserva" onClose={() => { if (!busy) setCancelTarget(null) }}><p>¿Quieres cancelar la solicitud de <strong>{cancelTarget.curso}</strong> del {shortDate(cancelTarget.fecha)}?</p><p className="muted">El horario se liberará si la reserva estaba confirmada.</p><div className="modal-actions"><button className="secondary" disabled={busy} onClick={() => setCancelTarget(null)}>Volver</button><button className="danger-button" disabled={busy} onClick={() => action(cancelTarget, 'cancelar')}>{busy ? 'Cancelando…' : 'Sí, cancelar reserva'}</button></div></Modal>}
    {labEditing && <LabForm code={code} lab={labEditing === 'new' ? undefined : labEditing} onClose={() => setLabEditing(null)} onSaved={() => { setLabEditing(null); refresh('Laboratorio guardado.') }} />}
    {blockOpen && <BlockForm code={code} labs={labs} onClose={() => setBlockOpen(false)} onSaved={() => { setBlockOpen(false); refresh('Bloqueo registrado en la agenda.') }} />}
    {notificationsOpen && <Modal title="Notificaciones" onClose={() => setNotificationsOpen(false)}><div className="notifications-list">{data?.notifications.length ? data.notifications.map(item => <article key={item.id}><Bell size={17} /><div><p>{item.mensaje}</p><small>Solicitud #{item.reserva_id} · {item.creada_en} UTC</small></div></article>) : <div className="empty-state"><Bell size={26} /><h3>Sin notificaciones</h3><p>Los cambios de tus solicitudes aparecerán aquí.</p></div>}</div></Modal>}
    {helpOpen && <Modal title="Una agenda, todos tus espacios" onClose={() => setHelpOpen(false)}><div className="help-content"><p>Selecciona una fecha y filtra los laboratorios. Pulsa una hora en la agenda para completar la solicitud lateral.</p><h3>Cómo funciona</h3><ul><li>Docentes: solicitan, modifican y cancelan sus reservas.</li><li>Delegados: solicitan para cursos y docentes autorizados.</li><li>Administración: aprueba solicitudes, bloquea horarios y mantiene el catálogo.</li><li>Coordinación: consulta reportes y autoriza cambios.</li></ul><p>Las franjas pueden tener varias clases si son en laboratorios distintos. Filtra por laboratorio para ver un único espacio.</p><div className="form-note"><Info size={17} /><span>Esta versión usa perfiles de demostración local y guarda las operaciones en SQLite. Las solicitudes pendientes no ocupan el horario hasta aprobarse.</span></div></div></Modal>}
  </div>
}
