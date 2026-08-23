import { CronExpressionParser } from "cron-parser"
import { toString as cronToString } from "cronstrue"

export type RecurrencePreset =
  | "daily"
  | "weekly"
  | "monthly"
  | "every_minutes"
  | "every_hours"
  | "yearly"
  | "custom"

export type PresetFields = {
  hour: number
  minute: number
  weekdays: number[] // 0..6, Sunday = 0
  dayOfMonth: number
  month: number
  intervalMinutes: number
  intervalHours: number
}

export const DEFAULT_PRESET_FIELDS: PresetFields = {
  hour: 18,
  minute: 0,
  weekdays: [1],
  dayOfMonth: 1,
  month: 1,
  intervalMinutes: 15,
  intervalHours: 2,
}

// presetToCron builds the standard 5-field cron expression for a friendly
// preset. The cron string is the single source of truth everywhere else.
export function presetToCron(preset: RecurrencePreset, fields: PresetFields): string {
  switch (preset) {
    case "daily":
      return `${fields.minute} ${fields.hour} * * *`
    case "weekly":
      return `${fields.minute} ${fields.hour} * * ${fields.weekdays.join(",")}`
    case "monthly":
      return `${fields.minute} ${fields.hour} ${fields.dayOfMonth} * *`
    case "every_minutes":
      return `*/${fields.intervalMinutes} * * * *`
    case "every_hours":
      return `${fields.minute} */${fields.intervalHours} * * *`
    case "yearly":
      return `${fields.minute} ${fields.hour} ${fields.dayOfMonth} ${fields.month} *`
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
  const isList = (value: string) => /^\d+(,\d+)*$/.test(value)
  const isEvery = (value: string) => /^\*\/\d+$/.test(value)
  const withFields = (fields: Partial<PresetFields>): PresetFields => ({
    ...DEFAULT_PRESET_FIELDS,
    ...fields,
  })

  if (isEvery(minute) && isStar(hour) && isStar(dom) && isStar(month) && isStar(dow)) {
    return {
      preset: "every_minutes",
      fields: withFields({ intervalMinutes: Number(minute.slice(2)) }),
    }
  }

  if (isSingle(minute) && isEvery(hour) && isStar(dom) && isStar(month) && isStar(dow)) {
    return {
      preset: "every_hours",
      fields: withFields({ minute: Number(minute), intervalHours: Number(hour.slice(2)) }),
    }
  }

  if (isStar(dow) && isStar(dom) && isStar(month)) {
    if (!isSingle(hour) || !isSingle(minute)) return { preset: "custom" }
    return { preset: "daily", fields: withFields({ hour: Number(hour), minute: Number(minute) }) }
  }

  if (isStar(dom) && isStar(month) && isList(dow)) {
    if (!isSingle(hour) || !isSingle(minute)) return { preset: "custom" }
    return {
      preset: "weekly",
      fields: withFields({
        hour: Number(hour),
        minute: Number(minute),
        weekdays: dow.split(",").map(Number),
      }),
    }
  }

  if (isStar(dow) && isStar(month) && isSingle(dom)) {
    if (!isSingle(hour) || !isSingle(minute)) return { preset: "custom" }
    return {
      preset: "monthly",
      fields: withFields({ hour: Number(hour), minute: Number(minute), dayOfMonth: Number(dom) }),
    }
  }

  if (isStar(dow) && isSingle(month) && isSingle(dom)) {
    if (!isSingle(hour) || !isSingle(minute)) return { preset: "custom" }
    return {
      preset: "yearly",
      fields: withFields({
        hour: Number(hour),
        minute: Number(minute),
        dayOfMonth: Number(dom),
        month: Number(month),
      }),
    }
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
