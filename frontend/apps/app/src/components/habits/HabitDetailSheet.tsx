import { BarChart3 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"

import { useHabitAnalytics } from "@/hooks/useHabits"
import type { Habit } from "@/types/habit.types"

export function HabitDetailSheet({
  habit,
  periodAverage,
  onClose,
}: {
  habit: Habit | null
  periodAverage: number | null
  onClose: () => void
}) {
  const analyticsQuery = useHabitAnalytics(habit?.id ?? "")
  const analytics = analyticsQuery.data?.analytics

  return (
    <Sheet open={Boolean(habit)} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            {habit?.name}
          </SheetTitle>
          <SheetDescription>
            {habit?.category_name}
            {habit?.target_unit ? ` · ${habit.target_unit}` : ""}
          </SheetDescription>
        </SheetHeader>

        {analytics ? (
          <div className="flex flex-col gap-6 px-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="This view" value={periodAverage === null ? "—" : `${periodAverage}%`} />
              <Metric label="30 days" value={`${analytics.completion_rate_30}%`} />
              <Metric label="90 days" value={`${analytics.completion_rate_90}%`} />
              <Metric label="Best week" value={`${analytics.best_week}%`} />
              <Metric label="Current streak" value={`${analytics.current_streak}`} />
              <Metric label="Longest streak" value={`${analytics.longest_streak}`} />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Last 90 days</h3>
              <div className="grid grid-cols-15 gap-1">
                {analytics.daily_completion.map((day) => (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.value}${day.scheduled ? "" : " (not scheduled)"}`}
                    className={`aspect-square rounded-sm ${
                      !day.scheduled
                        ? "bg-muted/30"
                        : day.completed
                          ? "bg-green-600"
                          : day.value > 0
                            ? "bg-yellow-400"
                            : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 text-sm text-muted-foreground">
            {analyticsQuery.isLoading ? "Loading analytics..." : "No analytics available."}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}