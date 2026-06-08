import {
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  GripVertical,
  LayoutGrid,
  NotebookPen,
  Target,
  X,
} from "lucide-react"
import type { ComponentType } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts"
import { Button } from "@workspace/ui/components/button"

import { useCurrentUser } from "@/hooks/useAuth"
import {
  useActivityHeatmap,
  useDashboardLayout,
  useDashboardSummary,
  useSaveDashboardLayout,
} from "@/hooks/useDashboard"
import { ActivityHeatmap } from "@/components/ActivityHeatmap"
import type { DashboardSummary } from "@/types/dashboard.types"

/* ─── Widget registry ─── */
interface WidgetDef {
  id: string
  label: string
  Component: ComponentType<{
    summary: DashboardSummary
    heatmapQuery: ReturnType<typeof useActivityHeatmap>
  }>
}

const DEFAULT_WIDGET_ORDER = [
  "metric-cards",
  "habit-chart",
  "productivity-chart",
  "activity-heatmap",
  "recent-notes",
]

const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "metric-cards", label: "Metric cards", Component: MetricCardsWidget },
  { id: "habit-chart", label: "Weekly habits", Component: HabitChartWidget },
  {
    id: "productivity-chart",
    label: "Weekly productivity",
    Component: ProductivityChartWidget,
  },
  {
    id: "activity-heatmap",
    label: "Activity heatmap",
    Component: ActivityHeatmapWidget,
  },
  { id: "recent-notes", label: "Recent notes", Component: RecentNotesWidget },
]

/* ─── Dashboard page ─── */
export function DashboardPage() {
  const { data } = useCurrentUser()
  const user = data?.user ?? null
  const dashboardQuery = useDashboardSummary()
  const layoutQuery = useDashboardLayout()
  const saveLayout = useSaveDashboardLayout()
  const summary = dashboardQuery.data?.summary
  const heatmapQuery = useActivityHeatmap()
  const [customizing, setCustomizing] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const savedLayout = layoutQuery.data?.layout
  const order = useMemo(() => {
    if (!savedLayout) return DEFAULT_WIDGET_ORDER
    const filtered = savedLayout.filter((id) =>
      WIDGET_REGISTRY.some((w) => w.id === id)
    )
    const missing = DEFAULT_WIDGET_ORDER.filter((id) => !filtered.includes(id))
    return [...filtered, ...missing]
  }, [savedLayout])

  const [currentOrder, setCurrentOrder] = useState(order)

  useEffect(() => {
    setCurrentOrder(order)
  }, [order])

  function onDragStart(id: string) {
    setDragId(id)
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function onDrop(targetId: string) {
    if (dragId === null || dragId === targetId) return
    setCurrentOrder((prev) => {
      const copy = [...prev]
      const from = copy.indexOf(dragId)
      const to = copy.indexOf(targetId)
      if (from === -1 || to === -1) return prev
      copy.splice(from, 1)
      copy.splice(to, 0, dragId)
      return copy
    })
    setDragId(null)
  }

  const handleSave = useCallback(async () => {
    await saveLayout.mutateAsync(currentOrder)
    setCustomizing(false)
  }, [currentOrder, saveLayout])

  function handleCancel() {
    setCurrentOrder(order)
    setCustomizing(false)
  }

  const widgets = useMemo(
    () =>
      currentOrder
        .map((id) => WIDGET_REGISTRY.find((w) => w.id === id))
        .filter(Boolean) as WidgetDef[],
    [currentOrder]
  )

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatDate(summary?.today)}
          </p>
          <h1 className="text-2xl font-semibold">
            Hello, {user?.name ?? "developer"}
          </h1>
        </div>
        <div className="flex gap-2">
          {customizing ? (
            <>
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X className="size-4" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saveLayout.isPending}
              >
                {saveLayout.isPending ? "Saving..." : "Save layout"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomizing(true)}
            >
              <LayoutGrid className="size-4" />
              Customize
            </Button>
          )}
          <Button asChild>
            <Link to="/focus">
              <Target className="size-4" />
              Start focus
            </Link>
          </Button>
        </div>
      </div>

      {dashboardQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      ) : null}
      {dashboardQuery.isError ? (
        <p className="text-sm text-destructive">
          Failed to load dashboard. Please try refreshing.
        </p>
      ) : null}
      {summary ? (
        <div className="space-y-6">
          {widgets.map(({ id, label, Component }) => (
            <DraggableWidget
              key={id}
              id={id}
              label={label}
              customizing={customizing}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <Component summary={summary} heatmapQuery={heatmapQuery} />
            </DraggableWidget>
          ))}
        </div>
      ) : null}
    </section>
  )
}

/* ─── Draggable widget wrapper ─── */
function DraggableWidget({
  id,
  label,
  customizing,
  onDragStart,
  onDragOver,
  onDrop,
  children,
}: {
  id: string
  label: string
  customizing: boolean
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (id: string) => void
  children: React.ReactNode
}) {
  return (
    <div
      draggable={customizing}
      onDragStart={() => onDragStart(id)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(id)}
      className={`relative ${customizing ? "cursor-grab rounded-xl border-2 border-dashed border-muted-foreground/30 p-1 active:cursor-grabbing" : ""}`}
    >
      {customizing ? (
        <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-xs font-medium text-muted-foreground">
          <GripVertical className="size-4" />
          {label}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/* ─── Widget: Metric cards ─── */
function MetricCardsWidget({
  summary,
}: {
  summary: DashboardSummary
  heatmapQuery: ReturnType<typeof useActivityHeatmap>
}) {
  const { week_comparison: wc } = summary
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={CheckCircle2}
        label="Tasks"
        value={`${summary.task_summary.done}/${summary.task_summary.total}`}
        detail="for today"
        href="/tasks"
        trend={trend(wc.tasks_done_this_week, wc.tasks_done_last_week)}
      />
      <MetricCard
        icon={Flame}
        label="Habits"
        value={`${summary.habit_summary.checked}/${summary.habit_summary.total}`}
        detail="checked today"
        href="/habits"
        trend={trend(wc.habits_checked_this_week, wc.habits_checked_last_week)}
      />
      <MetricCard
        icon={BookOpen}
        label="Learning streak"
        value={`${summary.learning_streak}`}
        detail="consecutive study days"
        href="/learn"
      />
      <MetricCard
        icon={Clock}
        label="Focus"
        value={
          summary.active_focus_session
            ? `${summary.active_focus_session.duration_minutes} min`
            : "Ready"
        }
        detail={summary.active_focus_session?.task_title ?? "Start a session"}
        href="/focus"
        trend={trend(wc.focus_minutes_this_week, wc.focus_minutes_last_week)}
      />
    </div>
  )
}

/* ─── Widget: Habit chart ─── */
function HabitChartWidget({
  summary,
}: {
  summary: DashboardSummary
  heatmapQuery: ReturnType<typeof useActivityHeatmap>
}) {
  const data = chartData(summary.weekly_habit_chart)
  const separatorIndex = data.length > 7 ? data.length - 7 : -1
  return (
    <div className="rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Habit completion (last 14 days)</h2>
      <p className="text-xs text-muted-foreground">Last week vs this week</p>
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid var(--color-border)",
              }}
              formatter={(value: any, name: any) => [
                value,
                name === "completed" ? "Completed" : "Total",
              ]}
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="var(--color-primary)"
              fill="var(--color-primary)"
              fillOpacity={0.4}
            />
            {separatorIndex > 0 ? (
              <ReferenceLine
                x={data[separatorIndex]?.day}
                stroke="var(--color-border)"
                strokeDasharray="4 4"
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ─── Widget: Productivity chart ─── */
function ProductivityChartWidget({
  summary,
}: {
  summary: DashboardSummary
  heatmapQuery: ReturnType<typeof useActivityHeatmap>
}) {
  const data = productivityData(summary.weekly_productivity)
  const separatorIndex = data.length > 7 ? data.length - 7 : -1
  return (
    <div className="rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Productivity (last 14 days)</h2>
      <p className="text-xs text-muted-foreground">Last week vs this week</p>
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid var(--color-border)",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="tasks"
              name="Tasks"
              stackId="a"
              stroke="var(--color-primary)"
              fill="var(--color-primary)"
              fillOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="habits"
              name="Habits"
              stackId="a"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.4}
            />
            <Area
              type="monotone"
              dataKey="learning"
              name="Learning"
              stackId="a"
              stroke="#a855f7"
              fill="#a855f7"
              fillOpacity={0.3}
            />
            {separatorIndex > 0 ? (
              <ReferenceLine
                x={data[separatorIndex]?.day}
                stroke="var(--color-border)"
                strokeDasharray="4 4"
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ─── Widget: Activity heatmap ─── */
function ActivityHeatmapWidget({
  heatmapQuery,
}: {
  summary: DashboardSummary
  heatmapQuery: ReturnType<typeof useActivityHeatmap>
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Activity</h2>
      <div className="mt-4">
        {heatmapQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading heatmap...</p>
        ) : heatmapQuery.data?.heatmap ? (
          <ActivityHeatmap data={heatmapQuery.data.heatmap} />
        ) : null}
      </div>
    </div>
  )
}

/* ─── Widget: Recent notes ─── */
function RecentNotesWidget({
  summary,
}: {
  summary: DashboardSummary
  heatmapQuery: ReturnType<typeof useActivityHeatmap>
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Recent notes</h2>
        <Button asChild variant="outline">
          <Link to="/notes">View all</Link>
        </Button>
      </div>
      <div className="mt-4 grid gap-2">
        {summary.recent_notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : null}
        {summary.recent_notes.map((note) => (
          <Link
            key={note.id}
            to="/notes"
            className="rounded-lg border p-3 text-sm hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <NotebookPen className="size-4 text-muted-foreground" />
              <p className="font-medium">{note.title}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {new Date(note.updated_at).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

/* ─── Shared helpers ─── */
function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
  trend,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  detail: string
  href: string
  trend?: { direction: "up" | "down" | "flat"; label: string }
}) {
  return (
    <Link
      to={href}
      className="rounded-xl border bg-background p-4 hover:bg-muted/50"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-sm text-muted-foreground">{detail}</p>
        {trend ? (
          <span
            className={`text-xs font-medium ${trend.direction === "up" ? "text-green-500" : trend.direction === "down" ? "text-red-500" : "text-muted-foreground"}`}
          >
            {trend.label}
          </span>
        ) : null}
      </div>
    </Link>
  )
}

function trend(
  current: number,
  previous: number
): { direction: "up" | "down" | "flat"; label: string } | undefined {
  if (previous === 0 && current === 0) return undefined
  if (previous === 0) return { direction: "up", label: "vs last week" }
  const diff = current - previous
  const pct = Math.round((diff / previous) * 100)
  if (pct === 0) return { direction: "flat", label: "vs last week" }
  return {
    direction: pct > 0 ? "up" : "down",
    label: `${pct > 0 ? "+" : ""}${pct}% vs last week`,
  }
}

function formatDate(value: string | undefined): string {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function shortDay(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { weekday: "short" })
}

function chartData(items: DashboardSummary["weekly_habit_chart"]) {
  return items.map((item) => ({
    day: shortDay(item.date),
    completed: item.checked,
  }))
}

function productivityData(items: DashboardSummary["weekly_productivity"]) {
  return items.map((item) => ({
    day: shortDay(item.date),
    tasks: item.tasks_done,
    habits: item.habits_checked,
    learning: item.learning_sessions,
  }))
}
