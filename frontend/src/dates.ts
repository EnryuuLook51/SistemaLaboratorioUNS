export function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function parseDate(value: string): Date { return new Date(`${value}T12:00:00`) }
export function plusDays(value: string, amount: number): string {
  const date = parseDate(value); date.setDate(date.getDate() + amount); return iso(date)
}
export function monday(value: string): string {
  const date = parseDate(value); return plusDays(value, -((date.getDay() + 6) % 7))
}
export const today = () => iso(new Date())
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
export const timeLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`
export function shortDate(value: string): string {
  return parseDate(value).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })
}
export function weekLabel(value: string): string {
  return `${parseDate(value).getDate()}–${parseDate(plusDays(value, 6)).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}`
}
