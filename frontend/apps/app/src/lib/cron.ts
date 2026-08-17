import { CronExpressionParser } from "cron-parser"
import { toString as cronToString } from "cronstrue"

export type RecurrencePreset = "daily" | "weekly" | "monthly" | "custom"

export type PresetFields = {
  hour: number
  minute: number
  dayOfWeek: number // 0..6, Sunday = 0 (used by weekly)
}

// presetToCron builds the standard 5-field cron expression for a friendly
// preset. The cron string is the single source of truth everywhere else.
export function presetToCron(preset: RecurrencePreset, fields: PresetFields): string {
  switch (preset) {
    case "daily":
      return `${fields.minute} ${fields.hour} * * *`
    case "weekly":
      return `${fields.minute} ${fields.hour} * * ${fields.dayOfWeek}`
    case "monthly":
      return `${fields.minute} ${fields.hour} 1 * *`
    case "custom":
      return ""
  }
}

export function isValidCron(expr: string): boolean {
  if (!expr.trim()) return false
  try {
    CronExpressionParser.parse(expr)
    return true
  } catch {
    return false
  }
}

// detectPreset returns the preset a cron maps back to, plus the fields needed to
// re-populate the friendly editor. Unrecognized or too-complex schedules come
// back as "custom", so the raw cron field shows and is editable without error.
export function detectPreset(
  expr: string
): { preset: RecurrencePreset; fields?: PresetFields } {
  if (!isValidCron(expr)) return { preset: "custom" }

  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return { preset: "custom" }

  const [minute, hour, dom, month, dow] = parts

  const isStar = (value: string) => value === "*"
  const isSingle = (value: string) => /^\d+$/.test(value)
  const isList = (value: string) => /^(\d|\d,\d+)+$/.test(value)

  if (isStar(dow) && isStar(dom) && isStar(month)) {
    if (!isSingle(hour) || !isSingle(minute)) return { preset: "custom" }
    const preset: RecurrencePreset = "daily"
    return { preset, fields: { hour: Number(hour), minute: Number(minute), dayOfWeek: 0 } }
  }

  if (isStar(dom) && isStar(month) && isList(dow)) {
    const dows = dow.split(",")
    // Only a single weekday maps to the "weekly" preset; multiple weekdays are
    // a valid custom schedule.
    if (dows.length === 1 && isSingle(dows[0]) && isSingle(hour) && isSingle(minute)) {
      const preset: RecurrencePreset = "weekly"
      return { preset, fields: { hour: Number(hour), minute: Number(minute), dayOfWeek: Number(dows[0]) } }
    }
    return { preset: "custom" }
  }

  if (isStar(dow) && isStar(month) && isSingle(dom) && dom === "1") {
    if (!isSingle(hour) || !isSingle(minute)) return { preset: "custom" }
    const preset: RecurrencePreset = "monthly"
    return { preset, fields: { hour: Number(hour), minute: Number(minute), dayOfWeek: 0 } }
  }

  return { preset: "custom" }
}

export async function describeCron(expr: string): Promise<string | null> {
  if (!isValidCron(expr)) return null
  try {
    return cronToString(expr, { throwExceptionOnParseError: false })
  } catch {
    return null
  }
}