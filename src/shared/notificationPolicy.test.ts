import { describe, expect, it } from 'vitest'
import { isQuietTime } from './notificationPolicy'

const at = (hour: number, minute = 0) => new Date(2026, 8, 19, hour, minute)

describe('notification quiet hours', () => {
  it('includes the start and excludes the end of a daytime interval', () => {
    const hours = { enabled: true, start: '09:30', end: '17:00' }
    expect(isQuietTime(hours, at(9, 29))).toBe(false)
    expect(isQuietTime(hours, at(9, 30))).toBe(true)
    expect(isQuietTime(hours, at(16, 59))).toBe(true)
    expect(isQuietTime(hours, at(17))).toBe(false)
  })
  it('handles an overnight interval across midnight using local time', () => {
    const hours = { enabled: true, start: '22:00', end: '08:00' }
    expect(isQuietTime(hours, at(21, 59))).toBe(false)
    expect(isQuietTime(hours, at(22))).toBe(true)
    expect(isQuietTime(hours, at(0))).toBe(true)
    expect(isQuietTime(hours, at(7, 59))).toBe(true)
    expect(isQuietTime(hours, at(8))).toBe(false)
  })
  it('treats disabled, absent and equal boundaries as unrestricted', () => {
    expect(isQuietTime(undefined, at(23))).toBe(false)
    expect(isQuietTime({ enabled: false, start: '22:00', end: '08:00' }, at(23))).toBe(false)
    expect(isQuietTime({ enabled: true, start: '00:00', end: '00:00' }, at(0))).toBe(false)
  })
})
