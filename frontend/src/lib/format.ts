// Formatting helpers. Server timestamps are UTC ISO strings; display in the browser's local time.

export function todayLocalISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function formatDeadline(iso: string, locale = 'en-GB'): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Today, ${time}`
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }) + `, ${time}`
}

export function formatDate(isoDate: string, locale = 'en-GB'): string {
  const d = new Date(isoDate.length === 10 ? `${isoDate}T12:00:00` : isoDate)
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatDateTime(iso: string, locale = 'en-GB'): string {
  return new Date(iso).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Convert an ISO timestamp into the value an <input type="datetime-local"> expects (local time). */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}

/** Interpret a datetime-local value in the browser's timezone and return UTC ISO. */
export function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString()
}

export function defaultDeadlineValue(): string {
  const d = new Date()
  d.setHours(23, 59, 0, 0)
  return toDatetimeLocalValue(d.toISOString())
}
