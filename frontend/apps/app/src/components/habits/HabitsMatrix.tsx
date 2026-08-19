import { useMemo } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip"

import { useLogHabit } from "@/hooks/useHabits"
import type { Habit, HabitMatrixLog } from "@/types/habit.types"
import { HabitCell } from "./HabitCell"
import {
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

  const dates = useMemo(() => listDateKeys(range.start, range.end), [range.start, range.end])

  const logsByKey = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of logs) {
      map.set(`${log.habit_id}|${log.logged_date}`, log.value)
    }
    return map
  }, [logs])

  function valueFor(habitID: string, dateKey: string): number {
    return logsByKey.get(`${habitID}|${dateKey}`) ?? 0
  }

  function toggleHabit(habit: Habit, dateKey: string, currentValue: number) {
    const nextValue =
      isHabitMet(habit, currentValue)
        ? 0
        : habit.type === "numeric" && habit.target_value !== null && habit.target_value !== undefined
          ? habit.target_value
          : 1
    void logHabit.mutateAsync({ habitId: habit.id, input: { logged_date: dateKey, value: nextValue } })
  }

  function logNumeric(habit: Habit, dateKey: string, value: number) {
    void logHabit.mutateAsync({ habitId: habit.id, input: { logged_date: dateKey, value } })
  }

  const dayStats = useMemo(() => {
    return dates.map((dateKey) => {
      const scheduled = habits.filter((habit) => isScheduledOn(habit, dateKey) && dateKey <= today)
      const completed = scheduled.filter((habit) => isHabitMet(habit, valueFor(habit.id, dateKey))).length
      return {
        dateKey,
        isFuture: dateKey > today,
        scheduledCount: scheduled.length,
        completed,
        percent: scheduled.length > 0 ? Math.round((completed / scheduled.length) * 100) : null,
      }
    })
  }, [dates, habits, logsByKey, today])

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
        percent: scheduledDays > 0 ? Math.round((completedDays / scheduledDays) * 100) : null,
        completedDays,
        scheduledDays,
      }
    })
  }, [habits, dates, logsByKey, today])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-x-auto rounded-xl border">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background text-muted-foreground">Date</TableHead>
              {habits.map((habit) => (
                <TableHead key={habit.id} className="min-w-20 px-2 text-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenHabit(habit)}
                        className="max-w-28 truncate font-medium"
                      >
                        {habit.name}
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
            {dayStats.map(({ dateKey, isFuture, scheduledCount, completed, percent }) => (
              <TableRow key={dateKey} className={isFuture ? "opacity-40" : undefined}>
                <TableCell className="sticky left-0 bg-background whitespace-nowrap text-sm">
                  <span className="font-medium">
                    {new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
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
                    <TableCell key={habit.id} className="px-2 py-2 text-center">
                      <HabitCell
                        habit={habit}
                        dateKey={dateKey}
                        value={valueFor(habit.id, dateKey)}
                        disabled={disabled}
                        onToggle={() => toggleHabit(habit, dateKey, valueFor(habit.id, dateKey))}
                        onLog={(value) => logNumeric(habit, dateKey, value)}
                      />
                    </TableCell>
                  )
                })}
                <TableCell className="px-2 py-2 text-center">
                  {isFuture ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground" title={`${completed}/${scheduledCount} scheduled habits`}>
                      {percent === null ? "—" : `${percent}%`}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50">
              <TableCell className="sticky left-0 bg-muted/50 font-semibold">Average</TableCell>
              {habitAverages.map(({ habit, percent }) => (
                <TableCell key={habit.id} className="px-2 py-2 text-center font-medium">
                  {percent === null ? "—" : `${percent}%`}
                </TableCell>
              ))}
              <TableCell className="px-2 py-2 text-center text-muted-foreground" />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}