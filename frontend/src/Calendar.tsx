import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { minutes, parseDate, plusDays, timeLabel, today, weekLabel } from './dates'
import type { Block, Schedule, ScheduleReservation } from './types'

interface Props {
  week: string; schedule: Schedule; onWeek: (week: string) => void;
  onSlot: (date: string, start: string, end: string) => void;
  onEvent: (event: ScheduleReservation | Block) => void
}

type Entry = (ScheduleReservation | Block) & { blocked: boolean }

// Las reservas de diferentes laboratorios pueden coincidir: se distribuyen en carriles.
function arrange(entries: Entry[]) {
  const sorted = [...entries].sort((a, b) => minutes(a.inicio) - minutes(b.inicio) || minutes(b.fin) - minutes(a.fin))
  const groups: Entry[][] = []
  let end = -1
  for (const entry of sorted) {
    if (minutes(entry.inicio) >= end) groups.push([])
    groups.at(-1)!.push(entry)
    end = Math.max(end, minutes(entry.fin))
  }
  return groups.flatMap(group => {
    const lanes: number[] = []
    const arranged = group.map(entry => {
      let lane = lanes.findIndex(end => end <= minutes(entry.inicio))
      if (lane < 0) lane = lanes.length
      lanes[lane] = minutes(entry.fin)
      return { entry, lane }
    })
    return arranged.map(item => ({ ...item, count: lanes.length }))
  })
}

export default function Calendar({ week, schedule, onWeek, onSlot, onEvent }: Props) {
  const [mobileDay, setMobileDay] = useState(0)
  const days = Array.from({ length: 7 }, (_, i) => plusDays(week, i))
  const entries: Entry[] = [
    ...schedule.reservas.map(item => ({ ...item, blocked: false })),
    ...schedule.bloqueos.map(item => ({ ...item, blocked: true })),
  ]
  const firstHour = Math.min(8, ...entries.map(entry => Math.floor(minutes(entry.inicio) / 60)))
  const lastHour = Math.max(18, ...entries.map(entry => Math.ceil(minutes(entry.fin) / 60)))
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
  const height = hours.length * 76
  return <section className="panel calendar-panel">
    <div className="panel-heading">
      <div><h2>Disponibilidad semanal</h2><p>{weekLabel(week)}</p></div>
      <div className="calendar-controls">
        <button className="quiet" onClick={() => onWeek(today())}>Hoy</button>
        <button className="icon-button" aria-label="Semana anterior" onClick={() => onWeek(plusDays(week, -7))}><ChevronLeft size={18} /></button>
        <button className="icon-button" aria-label="Semana siguiente" onClick={() => onWeek(plusDays(week, 7))}><ChevronRight size={18} /></button>
      </div>
    </div>
    <div className="calendar-legend"><span><i className="legend-dot blue" />Reservado</span><span><i className="legend-dot gray" />Bloqueado</span><span className="calendar-instruction">Elige una hora para solicitar</span></div>
    <div className="mobile-days" aria-label="Día de la agenda">{days.map((day, i) => <button key={day} aria-pressed={mobileDay === i} onClick={() => setMobileDay(i)} className={mobileDay === i ? 'active' : ''}>{parseDate(day).toLocaleDateString('es-PE', { weekday: 'short' })}<strong>{parseDate(day).getDate()}</strong></button>)}</div>
    <div className="calendar-scroll">
      <div className="calendar-grid" style={{ '--day-height': `${height}px` } as React.CSSProperties}>
        <div className="time-header">HORA</div>
        {days.map((day, i) => <div key={day} className={`day-header ${mobileDay === i ? 'mobile-selected' : ''} ${day === today() ? 'is-today' : ''}`}><span>{parseDate(day).toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '')}</span><strong>{parseDate(day).getDate()}</strong></div>)}
        <div className="time-column">{hours.map(hour => <span key={hour}>{timeLabel(hour)}</span>)}</div>
        {days.map((day, i) => <div key={day} className={`day-column ${mobileDay === i ? 'mobile-selected' : ''}`}>
          {hours.map(hour => <button key={hour} className="time-slot" aria-label={`Solicitar ${shortDay(day)} a las ${timeLabel(hour)}`} onClick={() => onSlot(day, timeLabel(hour), hour === 23 ? '23:59' : timeLabel(hour + 1))} />)}
          {arrange(entries.filter(entry => entry.fecha === day)).map(({ entry, lane, count }) => <button
            key={`${entry.blocked ? 'b' : 'r'}${entry.id}`}
            className={`calendar-event ${entry.blocked ? 'blocked' : ['blue', 'green', 'purple'][entry.laboratorio_id % 3]}`}
            style={{ top: `${(minutes(entry.inicio) / 60 - firstHour) * 76 + 3}px`, height: `${Math.max(25, (minutes(entry.fin) - minutes(entry.inicio)) / 60 * 76 - 6)}px`, left: `calc(${lane / count * 100}% + 4px)`, width: `calc(${100 / count}% - 8px)` }}
            title={`${entry.laboratorio} · ${entry.inicio}–${entry.fin}`} onClick={() => onEvent(entry)}>
            <strong>{entry.laboratorio_codigo}</strong><span>{entry.inicio}–{entry.fin}</span><small>{'curso' in entry ? entry.curso : entry.motivo}</small>
          </button>)}
        </div>)}
      </div>
    </div>
    <div className="calendar-note"><Info size={15} /><span>{entries.length ? 'Ocupación real de todos los laboratorios seleccionados.' : 'No hay reservas confirmadas ni bloqueos esta semana.'} El horario se comprueba al aprobar.</span></div>
    <div className="calendar-mobile-help"><CalendarDays size={14} /> También puedes consultar sábado y domingo.</div>
  </section>
}

function shortDay(value: string) {
  return parseDate(value).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
}
