import type { Habit } from "@/types/habit.types"

export type DateRange = { start: string; end: string }

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function weekRange(anchor: Date): DateRange {
  const day = anchor.getDay()
  const diffToMonday = (day + 6) % 7
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() - diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: toDateKey(monday), end: toDateKey(sunday) }
}

export function monthRange(anchor: Date): DateRange {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  return { start: toDateKey(first), end: toDateKey(last) }
}

export function listDateKeys(start: string, end: string): string[] {
  const keys: string[] = []
  const cursor = parseDateKey(start)
  const endDate = parseDateKey(end)
  while (cursor <= endDate) {
    keys.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

export function weekdayOf(dateKey: string): number {
  const weekday = parseDateKey(dateKey).getDay()
  return weekday === 0 ? 7 : weekday
}

export function isScheduledOn(habit: Habit, dateKey: string): boolean {
  if (habit.frequency_type !== "weekly") return true
  return habit.frequency_days.includes(weekdayOf(dateKey))
}

export function isHabitMet(habit: Habit, value: number): boolean {
  if (habit.type === "boolean") return value >= 1
  if (habit.target_value === null || habit.target_value === undefined) return value > 0
  if (habit.comparison_operator === "lte") return value <= habit.target_value
  if (habit.comparison_operator === "eq") return value === habit.target_value
  if (habit.comparison_operator === "between") {
    if (habit.target_value_max === null || habit.target_value_max === undefined) return false
    return value >= habit.target_value && value <= habit.target_value_max
  }
  return value >= habit.target_value
}

export function defaultLogValueForHabit(habit: Habit): number {
  if (habit.type === "boolean") return 1
  if (habit.target_value === null || habit.target_value === undefined) return 1
  return habit.target_value
}

export function valueThatFailsHabit(habit: Habit): number {
  if (habit.comparison_operator === "lte") return (habit.target_value ?? 0) + 1
  if (
    habit.comparison_operator === "eq" &&
    habit.target_value !== null &&
    habit.target_value !== undefined
  ) {
    return habit.target_value !== 0 ? 0 : 1
  }
  if (habit.comparison_operator === "between") {
    return (habit.target_value_max ?? habit.target_value ?? 0) + 1
  }
  return 0
}

export function rangeLabel(range: DateRange, view: "week" | "month"): string {
  if (view === "week") {
    const start = parseDateKey(range.start)
    return start.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }
  const start = parseDateKey(range.start)
  return start.toLocaleDateString(undefined, { month: "long", year: "numeric" })
}
