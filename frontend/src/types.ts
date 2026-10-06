export type Role = 'docente' | 'delegado' | 'administrador' | 'coordinador'
export type Status = 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada'

export interface User { id: number; codigo_institucional: string; nombre: string; rol: Role; correo?: string }
export interface Lab { id: number; codigo: string; nombre: string; ubicacion: string; capacidad: number; equipos: string; activo: number }
export interface Course { id: number; codigo: string; nombre: string }
export interface Reservation {
  id: number; laboratorio_id: number; laboratorio: string; curso_id: number; curso: string;
  solicitante_id: number; solicitante: string; responsable_id: number; responsable: string;
  fecha: string; inicio: string; fin: string; participantes: number; estado: Status;
  creada_en: string; actualizada_en: string
}
export interface ScheduleReservation {
  id: number; laboratorio_id: number; laboratorio_codigo: string; laboratorio: string;
  curso: string; fecha: string; inicio: string; fin: string; participantes: number; estado: Status
}
export interface Block { id: number; laboratorio_id: number; laboratorio_codigo: string; laboratorio: string; fecha: string; inicio: string; fin: string; motivo: string }
export interface Schedule { reservas: ScheduleReservation[]; bloqueos: Block[] }
export interface Delegation { curso_id: number; delegado_id: number; docente_id: number; curso: string; docente: string }
export interface Notification { id: number; usuario_id: number; reserva_id: number | null; mensaje: string; leida_en: string | null; creada_en: string }
export interface Usage { id: number; codigo: string; nombre: string; reservas_confirmadas: number }
export interface BookingForm { laboratorio_id: string; curso_id: string; responsable_id: string; fecha: string; inicio: string; fin: string; participantes: string }
