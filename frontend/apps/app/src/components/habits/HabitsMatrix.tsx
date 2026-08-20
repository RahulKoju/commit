import { useCallback, useMemo } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

import { useLogHabit } from "@/hooks/useHabits"
import type { Habit, HabitMatrixLog } from "@/types/habit.types"
import { HabitCell } from "./HabitCell"
import { HabitIcon } from "./HabitIcon"
import {
  defaultLogValueForHabit,
  isHabitMet,
  isScheduledOn,
  listDateKeys,
  type DateRange,
} from "./habitMatrixUtils"

export function HabitsMatrix({
  habits,
  logs,
  range,
  today,
  onOpenHabit,
}: {
  habits: Habit[]
  logs: HabitMatrixLog[]
  range: DateRange
  today: string
  onOpenHabit: (habit: Habit) => void
}) {
  const logHabit = useLogHabit()

  const dates = useMemo(
    () => listDateKeys(range.start, range.end),
    [range.start, range.end]
  )

  const logsByKey = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of logs) {
      map.set(`${log.habit_id}|${log.logged_date}`, log.value)
    }
    return map
  }, [logs])

  const valueFor = useCallback(
    (habitID: string, dateKey: string): number => {
      return logsByKey.get(`${habitID}|${dateKey}`) ?? 0
    },
    [logsByKey]
  )

  function toggleHabit(habit: Habit, dateKey: string, currentValue: number) {
    const nextValue = isHabitMet(habit, currentValue)
      ? 0
      : defaultLogValueForHabit(habit)
    void logHabit.mutateAsync({
      habitId: habit.id,
      input: { logged_date: dateKey, value: nextValue },
    })
  }

  function logNumeric(habit: Habit, dateKey: string, value: number) {
    void logHabit.mutateAsync({
      habitId: habit.id,
      input: { logged_date: dateKey, value },
    })
  }

  const dayStats = useMemo(() => {
    return dates.map((dateKey) => {
      const scheduled = habits.filter(
        (habit) => isScheduledOn(habit, dateKey) && dateKey <= today
      )
      const completed = scheduled.filter((habit) =>
        isHabitMet(habit, valueFor(habit.id, dateKey))
      ).length
      return {
        dateKey,
        isFuture: dateKey > today,
        scheduledCount: scheduled.length,
        completed,
        percent:
          scheduled.length > 0
            ? Math.round((completed / scheduled.length) * 100)
            : null,
      }
    })
  }, [dates, habits, today, valueFor])

  const habitAverages = useMemo(() => {
    return habits.map((habit) => {
      let scheduledDays = 0
      let completedDays = 0
      for (const dateKey of dates) {
        if (dateKey > today) continue
        if (!isScheduledOn(habit, dateKey)) continue
        scheduledDays++
        if (isHabitMet(habit, valueFor(habit.id, dateKey))) completedDays++
      }
      return {
        habit,
        percent:
          scheduledDays > 0
            ? Math.round((completedDays / scheduledDays) * 100)
            : null,
        completedDays,
        scheduledDays,
      }
    })
  }, [habits, dates, today, valueFor])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative rounded-xl border">
        <div className="habit-matrix-scroll overflow-x-auto overscroll-x-contain pb-2">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-24 rounded-xl bg-background text-muted-foreground">
                  Date
                </TableHead>
                {habits.map((habit) => (
                  <TableHead
                    key={habit.id}
                    className="min-w-16 px-1 text-center sm:min-w-20 sm:px-2"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenHabit(habit)}
                          title={habit.name}
                          aria-label={`Open ${habit.name} details`}
                          className="px-1 text-center sm:px-3"
                        >
                          <HabitIcon
                            habit={habit}
                            className="text-base leading-none sm:text-lg"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{habit.name}</TooltipContent>
                    </Tooltip>
                  </TableHead>
                ))}
                <TableHead className="px-2 text-center">Day %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayStats.map(
                ({ dateKey, isFuture, scheduledCount, completed, percent }) => (
                  <TableRow
                    key={dateKey}
                    className={isFuture ? "opacity-40" : undefined}
                  >
                    <TableCell className="sticky left-0 z-10 bg-background text-xs whitespace-nowrap sm:text-sm">
                      <span className="font-medium">
                        {new Date(`${dateKey}T00:00:00`).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                      {dateKey === today ? (
                        <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                          Today
                        </span>
                      ) : null}
                    </TableCell>
                    {habits.map((habit) => {
                      const scheduled = isScheduledOn(habit, dateKey)
                      const disabled = !scheduled || isFuture
                      return (
                        <TableCell
                          key={habit.id}
                          className="px-1 py-2 text-center sm:px-2"
                        >
                          <HabitCell
                            habit={habit}
                            dateKey={dateKey}
                            value={valueFor(habit.id, dateKey)}
                            disabled={disabled}
                            onToggle={() =>
                              toggleHabit(
                                habit,
                                dateKey,
                                valueFor(habit.id, dateKey)
                              )
                            }
                            onLog={(value) => logNumeric(habit, dateKey, value)}
                          />
                        </TableCell>
                      )
                    })}
                    <TableCell className="px-1 py-2 text-center sm:px-2">
                      {isFuture ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span
                          className="text-xs font-medium text-muted-foreground"
                          title={`${completed}/${scheduledCount} scheduled habits`}
                        >
                          {percent === null ? "—" : `${percent}%`}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              )}
              <TableRow className="bg-muted/50">
                <TableCell className="sticky left-0 z-10 bg-muted/50 font-semibold">
                  Average
                </TableCell>
                {habitAverages.map(({ habit, percent }) => (
                  <TableCell
                    key={habit.id}
                    className="px-1 py-2 text-center font-medium sm:px-2"
                  >
                    {percent === null ? "—" : `${percent}%`}
                  </TableCell>
                ))}
                <TableCell className="px-2 py-2 text-center text-muted-foreground" />
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-xl bg-linear-to-l from-background to-transparent"
        />
      </div>
    </TooltipProvider>
  )
}
