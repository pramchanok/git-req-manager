import { describe, expect, test } from 'vitest'
import { getTimeframeRange, isWithin, shiftReferenceDate } from './timeframe'

/** วันพุธที่ 15 ก.ค. 2026 เวลา 14:30 ตามเวลาเครื่อง */
const WEDNESDAY = new Date(2026, 6, 15, 14, 30)

describe('getTimeframeRange', () => {
  test('daily ครอบคลุมตั้งแต่เที่ยงคืนถึงสิ้นวันเดียวกัน', () => {
    const { sinceIso, untilIso } = getTimeframeRange('daily', WEDNESDAY)

    expect(new Date(sinceIso)).toEqual(new Date(2026, 6, 15, 0, 0, 0, 0))
    expect(new Date(untilIso)).toEqual(new Date(2026, 6, 15, 23, 59, 59, 999))
  })

  test('weekly เริ่มวันจันทร์และจบวันอาทิตย์ของสัปดาห์นั้น', () => {
    const { sinceIso, untilIso } = getTimeframeRange('weekly', WEDNESDAY)

    expect(new Date(sinceIso)).toEqual(new Date(2026, 6, 13, 0, 0, 0, 0)) // จันทร์
    expect(new Date(untilIso)).toEqual(new Date(2026, 6, 19, 23, 59, 59, 999)) // อาทิตย์
  })

  test('weekly ของวันอาทิตย์นับเป็นสัปดาห์ที่กำลังจะจบ ไม่ใช่สัปดาห์ถัดไป', () => {
    const sunday = new Date(2026, 6, 19, 9, 0)
    const { sinceIso, untilIso } = getTimeframeRange('weekly', sunday)

    expect(new Date(sinceIso)).toEqual(new Date(2026, 6, 13, 0, 0, 0, 0))
    expect(new Date(untilIso)).toEqual(new Date(2026, 6, 19, 23, 59, 59, 999))
  })

  test('monthly จบที่วันสุดท้ายจริงของเดือน', () => {
    const { sinceIso, untilIso } = getTimeframeRange('monthly', WEDNESDAY)

    expect(new Date(sinceIso)).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0))
    expect(new Date(untilIso)).toEqual(new Date(2026, 6, 31, 23, 59, 59, 999))
  })

  test('monthly รองรับเดือนกุมภาพันธ์ปีอธิกสุรทิน', () => {
    const { untilIso } = getTimeframeRange('monthly', new Date(2028, 1, 10))
    expect(new Date(untilIso)).toEqual(new Date(2028, 1, 29, 23, 59, 59, 999))
  })

  // นี่คือหัวใจของบั๊กเดิม: ย้อนไปดูสัปดาห์ที่แล้วแล้วยอดรวมงานของสัปดาห์นี้เข้ามาด้วย
  test('ช่วงย้อนหลังไม่คาบเกี่ยวกับช่วงปัจจุบัน', () => {
    const thisWeek = getTimeframeRange('weekly', WEDNESDAY)
    const lastWeek = getTimeframeRange('weekly', shiftReferenceDate('weekly', WEDNESDAY, 'prev'))

    expect(lastWeek.untilIso < thisWeek.sinceIso).toBe(true)

    // MR ที่สร้างสัปดาห์นี้ต้องไม่ถูกนับเข้าช่วงของสัปดาห์ที่แล้ว
    const createdThisWeek = new Date(2026, 6, 15, 10, 0).toISOString()
    expect(isWithin(createdThisWeek, lastWeek.sinceIso, lastWeek.untilIso)).toBe(false)
    expect(isWithin(createdThisWeek, thisWeek.sinceIso, thisWeek.untilIso)).toBe(true)
  })
})

describe('shiftReferenceDate', () => {
  test('เลื่อนทีละหน่วยตาม timeframe', () => {
    expect(shiftReferenceDate('daily', WEDNESDAY, 'next').getDate()).toBe(16)
    expect(shiftReferenceDate('weekly', WEDNESDAY, 'prev').getDate()).toBe(8)
    expect(shiftReferenceDate('monthly', WEDNESDAY, 'next').getMonth()).toBe(7)
  })

  test('ไม่แก้ค่า Date ตัวเดิม', () => {
    const original = new Date(WEDNESDAY)
    shiftReferenceDate('monthly', original, 'next')
    expect(original).toEqual(WEDNESDAY)
  })

  test('เปลี่ยนเดือนไม่ข้ามเดือนเมื่อวันอ้างอิงเป็นวันที่ 29-31', () => {
    const january31 = new Date(2026, 0, 31, 12, 0)
    const next = shiftReferenceDate('monthly', january31, 'next')
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(1)
  })
})

describe('isWithin', () => {
  const since = new Date(2026, 6, 13, 0, 0, 0, 0).toISOString()
  const until = new Date(2026, 6, 19, 23, 59, 59, 999).toISOString()

  test('นับรวมค่าที่อยู่ตรงขอบทั้งสองด้าน', () => {
    expect(isWithin(since, since, until)).toBe(true)
    expect(isWithin(until, since, until)).toBe(true)
  })

  test('คืน false เมื่อไม่มีค่า (เช่น mergedAt ของ MR ที่ยังไม่ merge)', () => {
    expect(isWithin(null, since, until)).toBe(false)
    expect(isWithin(undefined, since, until)).toBe(false)
    expect(isWithin('', since, until)).toBe(false)
  })
})
