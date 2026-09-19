export function isQuietTime(hours: { enabled: boolean; start: string; end: string } | undefined, now = new Date()): boolean {
  if (!hours?.enabled || hours.start === hours.end) return false
  const minutes = now.getHours() * 60 + now.getMinutes()
  const parse = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m }
  const start = parse(hours.start)
  const end = parse(hours.end)
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}
