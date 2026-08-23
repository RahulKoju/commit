import type { Habit } from "@/types/habit.types"

const FALLBACK_STYLES = [
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
]

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return hash
}

export function HabitIcon({ habit, className }: { habit: Habit; className?: string }) {
  if (habit.icon) {
    return (
      <span aria-hidden="true" className={className}>
        {habit.icon}
      </span>
    )
  }
  const initial = habit.name.trim().charAt(0).toUpperCase() || "?"
  const style = FALLBACK_STYLES[hashName(habit.name) % FALLBACK_STYLES.length]
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${style} ${className ?? ""}`}
    >
      {initial}
    </span>
  )
}