import { useMemo, useState } from "react"
import { Settings2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { HabitDetailSheet } from "@/components/habits/HabitDetailSheet"
import { HabitsMatrix } from "@/components/habits/HabitsMatrix"
import { ManageHabitsDialog } from "@/components/habits/ManageHabitsDialog"
import { useHabitMatrix, useHabits } from "@/hooks/useHabits"
import type { Habit } from "@/types/habit.types"
import {
  isHabitMet,
  isScheduledOn,
  listDateKeys,
  monthRange,
  rangeLabel,
  toDateKey,
  weekRange,
  type DateRange,
} from "@/components/habits/habitMatrixUtils"

export function HabitsPage() {
  const habitsQuery = useHabits()
  const [view, setView] = useState<"week" | "month">("week")
  const [manageOpen, setManageOpen] = useState(false)
  const [detailHabit, setDetailHabit] = useState<Habit | null>(null)

  const today = toDateKey(new Date())

  const range: DateRange = useMemo(() => {
    const anchor = new Date()
    return view === "week" ? weekRange(anchor) : monthRange(anchor)
  }, [view])

  const matrixQuery = useHabitMatrix(range.start, range.end)

  const detailPeriodAverage = useMemo(() => {
    if (!detailHabit || !matrixQuery.data) return null
    const { logs } = matrixQuery.data
    const logMap = new Map(logs.map((log) => [`${log.habit_id}|${log.logged_date}`, log.value]))
    let scheduled = 0
    let completed = 0
    for (const dateKey of listDateKeys(range.start, range.end)) {
      if (dateKey > today) continue
      if (!isScheduledOn(detailHabit, dateKey)) continue
      scheduled++
      if (isHabitMet(detailHabit, logMap.get(`${detailHabit.id}|${dateKey}`) ?? 0)) completed++
    }
    return scheduled > 0 ? Math.round((completed / scheduled) * 100) : null
  }, [detailHabit, matrixQuery.data, range, today])

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Habits</h1>
          <p className="text-sm text-muted-foreground">
            Check in daily, track numeric targets, and review streaks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => setView("week")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                view === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Month
            </button>
          </div>
          <Button type="button" variant="outline" onClick={() => setManageOpen(true)}>
            <Settings2 />
            Manage
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{rangeLabel(range, view)}</span>
        {matrixQuery.isFetching ? <span className="text-xs">Refreshing...</span> : null}
      </div>

      {matrixQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading habits...</p>
      ) : (
        <HabitsMatrix
          habits={matrixQuery.data?.habits ?? habitsQuery.data?.habits ?? []}
          logs={matrixQuery.data?.logs ?? []}
          range={range}
          today={today}
          onOpenHabit={setDetailHabit}
        />
      )}

      <ManageHabitsDialog open={manageOpen} onOpenChange={setManageOpen} />
      <HabitDetailSheet habit={detailHabit} periodAverage={detailPeriodAverage} onClose={() => setDetailHabit(null)} />
    </section>
  )
}