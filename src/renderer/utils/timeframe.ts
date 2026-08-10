import { formatDate } from './dateFormat'

export type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly'

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
      label: formatDate(start),
    }
  }

  if (timeframe === 'weekly') {
    const day = start.getDay()
    start.setDate(start.getDate() - day + (day === 0 ? -6 : 1))
    start.setHours(0, 0, 0, 0)

    end.setTime(start.getTime())
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return {
      sinceIso: start.toISOString(),
      untilIso: end.toISOString(),
      label: `${formatDate(start)} - ${formatDate(end)}`,
    }
  }

  if (timeframe === 'yearly') {
    start.setMonth(0, 1)
    start.setHours(0, 0, 0, 0)

    end.setFullYear(start.getFullYear(), 11, 31)
    end.setHours(23, 59, 59, 999)

    return {
      sinceIso: start.toISOString(),
      untilIso: end.toISOString(),
      label: `${start.getFullYear()} (${formatDate(start)} - ${formatDate(end)})`,
    }
  }

  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้
  end.setTime(start.getTime())
  end.setMonth(end.getMonth() + 1)
  end.setDate(0)
  end.setHours(23, 59, 59, 999)

  return {
    sinceIso: start.toISOString(),
    untilIso: end.toISOString(),
    label: `${formatDate(start)} - ${formatDate(end)}`,
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
  else if (timeframe === 'yearly') next.setFullYear(next.getFullYear() + offset)
  else {
    next.setDate(1)
    next.setMonth(next.getMonth() + offset)
  }

  return next
}

/** MR อยู่ในช่วงเวลานี้ไหม */
export function isWithin(iso: string | null | undefined, since: string, until: string): boolean {
  return !!iso && iso >= since && iso <= until
}
