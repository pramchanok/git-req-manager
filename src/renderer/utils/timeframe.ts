export type Timeframe = 'daily' | 'weekly' | 'monthly'

export interface TimeframeRange {
  /** ต้นช่วง (inclusive) เป็น ISO string */
  sinceIso: string
  /** ปลายช่วง (inclusive) เป็น ISO string — ต้องใช้คู่กับ sinceIso เสมอ */
  untilIso: string
  /** ข้อความบอกช่วงเวลาสำหรับแสดงผล */
  label: string
}

/**
 * คำนวณช่วงเวลาของรายงานจากวันอ้างอิง
 *
 * สำคัญ: ต้องคืน "ขอบบน" (untilIso) ด้วยเสมอ ไม่ใช่แค่ขอบล่าง — เดิมโค้ดกรองด้วย
 * `createdAt >= sinceIso` อย่างเดียว ทำให้เวลาย้อนไปดูสัปดาห์/เดือนที่แล้ว
 * ตัวเลขจะรวมงานของช่วงหลังจากนั้นจนถึงปัจจุบันเข้ามาด้วย
 */
export function getTimeframeRange(timeframe: Timeframe, referenceDate: Date): TimeframeRange {
  const start = new Date(referenceDate)
  const end = new Date(referenceDate)

  if (timeframe === 'daily') {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return {
      sinceIso: start.toISOString(),
      untilIso: end.toISOString(),
      label: start.toLocaleDateString(),
    }
  }

  if (timeframe === 'weekly') {
    // จันทร์เป็นวันแรกของสัปดาห์ (getDay() คืน 0 = อาทิตย์)
    const day = start.getDay()
    start.setDate(start.getDate() - day + (day === 0 ? -6 : 1))
    start.setHours(0, 0, 0, 0)

    end.setTime(start.getTime())
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return {
      sinceIso: start.toISOString(),
      untilIso: end.toISOString(),
      label: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    }
  }

  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้ (รองรับ 28/29/30/31 อัตโนมัติ)
  end.setTime(start.getTime())
  end.setMonth(end.getMonth() + 1)
  end.setDate(0)
  end.setHours(23, 59, 59, 999)

  return {
    sinceIso: start.toISOString(),
    untilIso: end.toISOString(),
    label: start.toLocaleString('default', { month: 'long', year: 'numeric' }),
  }
}

/** เลื่อนวันอ้างอิงไปข้างหน้า/ถอยหลังหนึ่งช่วงตาม timeframe */
export function shiftReferenceDate(
  timeframe: Timeframe,
  referenceDate: Date,
  direction: 'prev' | 'next'
): Date {
  const offset = direction === 'prev' ? -1 : 1
  const next = new Date(referenceDate)

  if (timeframe === 'daily') next.setDate(next.getDate() + offset)
  else if (timeframe === 'weekly') next.setDate(next.getDate() + offset * 7)
  else {
    // Normalize to the first day before changing month. Otherwise Jan 31 + 1
    // month overflows into March instead of selecting February.
    next.setDate(1)
    next.setMonth(next.getMonth() + offset)
  }

  return next
}

/** MR อยู่ในช่วงเวลานี้ไหม — เทียบ ISO string ตรงๆ ได้เพราะเรียงตามลำดับตัวอักษรตรงกับเวลา */
export function isWithin(iso: string | null | undefined, since: string, until: string): boolean {
  return !!iso && iso >= since && iso <= until
}
