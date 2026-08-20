import {
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
import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
  "overall-activity-heatmap",
  "recent-notes",
]

const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "metric-cards", label: "Metric cards", Component: MetricCardsWidget },
  { id: "habit-chart", label: "Weekly habits", Component: HabitChartWidget },
  {
    id: "productivity-chart",
    label: "Everything else",
    Component: ProductivityChartWidget,
  },
  {
    id: "activity-heatmap",
    label: "Habits heatmap",
    Component: ActivityHeatmapWidget,
  },
  {
    id: "overall-activity-heatmap",
    label: "Overall activity heatmap",
    Component: OverallActivityHeatmapWidget,
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

  function startCustomizing() {
    setCurrentOrder(order)
    setCustomizing(true)
  }

  const displayOrder = customizing ? currentOrder : order
  const widgets = useMemo(
    () =>
      displayOrder
        .map((id) => WIDGET_REGISTRY.find((w) => w.id === id))
        .filter(Boolean) as WidgetDef[],
    [displayOrder]
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
              onClick={startCustomizing}
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
              dataKey="date"
              tickFormatter={shortDay}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              content={<HabitChartTooltip />}
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
                x={data[separatorIndex]?.date}
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

/* ─── Widget: Everything else chart ─── */
function ProductivityChartWidget({
  summary,
}: {
  summary: DashboardSummary
  heatmapQuery: ReturnType<typeof useActivityHeatmap>
}) {
  const data = productivityData(summary.weekly_productivity)
  return (
    <div className="rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Everything else (last 14 days)</h2>
      <p className="text-xs text-muted-foreground">
        Tasks completed, focus minutes, notes &amp; reminders created
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <MiniAreaChart data={data} dataKey="tasks" label="Tasks completed" valueLabel="tasks completed" color="var(--color-primary)" />
        <MiniAreaChart data={data} dataKey="focus" label="Focus minutes" valueLabel="focus minutes" color="#8b5cf6" />
        <MiniAreaChart data={data} dataKey="created" label="Notes + reminders" valueLabel="notes/reminders created" color="#22c55e" />
      </div>
    </div>
  )
}

function MiniAreaChart({
  data,
  dataKey,
  label,
  valueLabel,
  color,
}: {
  data: { date: string; day: string; [key: string]: string | number }[]
  dataKey: string
  label: string
  valueLabel: string
  color: string
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data}>
          <XAxis
            dataKey="date"
            tickFormatter={shortDay}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            content={<MiniChartTooltip valueLabel={valueLabel} />}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.35} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function MiniChartTooltip({
  active,
  payload,
  valueLabel,
}: {
  active?: boolean
  payload?: Array<{ payload?: MiniChartDatum; value?: number }>
  valueLabel: string
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null
  const value = payload[0]?.value ?? 0
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{formatDateKey(item.date)}</p>
      <p className="text-muted-foreground">
        {value} {valueLabel}
      </p>
    </div>
  )
}

function HabitChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: HabitChartDatum }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{formatDateKey(item.date)}</p>
      <p className="text-muted-foreground">
        {item.completed}/{item.total} habits
      </p>
    </div>
  )
}

/* ─── Widget: Habits heatmap ─── */
function ActivityHeatmapWidget({
  heatmapQuery,
}: {
  summary: DashboardSummary
  heatmapQuery: ReturnType<typeof useActivityHeatmap>
}) {
  const items = useMemo(
    () =>
      (heatmapQuery.data?.habit_heatmap ?? []).map((item) => ({
        date: item.date,
        level: item.total > 0 ? Math.round((item.completed / item.total) * 4) : 0,
        title: `${item.date}: ${item.completed}/${item.total} habits`,
      })),
    [heatmapQuery.data]
  )
  return (
    <div className="rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Habits</h2>
      <div className="mt-4">
        {heatmapQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading heatmap...</p>
        ) : items.length > 0 ? (
          <ActivityHeatmap data={items} />
        ) : null}
      </div>
    </div>
  )
}

/* ─── Widget: Overall activity heatmap ─── */
function OverallActivityHeatmapWidget({
  heatmapQuery,
}: {
  summary: DashboardSummary
  heatmapQuery: ReturnType<typeof useActivityHeatmap>
}) {
  const items = useMemo(
    () =>
      (heatmapQuery.data?.activity_heatmap ?? []).map((item) => ({
        date: item.date,
        level: item.level,
        title: `${item.date}: ${item.points} points`,
      })),
    [heatmapQuery.data]
  )
  return (
    <div className="rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Overall activity</h2>
      <p className="text-xs text-muted-foreground">
        Tasks, focus, notes &amp; reminders combined
      </p>
      <div className="mt-4">
        {heatmapQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading heatmap...</p>
        ) : items.length > 0 ? (
          <ActivityHeatmap data={items} />
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
  const date = value ? parseDateKey(value) : new Date()
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function shortDay(value: string): string {
  return parseDateKey(value).toLocaleDateString(undefined, { weekday: "short" })
}

function formatDateKey(value: string): string {
  return parseDateKey(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function parseDateKey(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

type HabitChartDatum = {
  date: string
  completed: number
  total: number
}

type MiniChartDatum = {
  date: string
  day: string
  tasks: number
  focus: number
  created: number
}

function chartData(items: DashboardSummary["weekly_habit_chart"]) {
  return items.map((item): HabitChartDatum => ({
    date: item.date,
    completed: item.checked,
    total: item.total,
  }))
}

function productivityData(items: DashboardSummary["weekly_productivity"]) {
  return items.map((item): MiniChartDatum => ({
    date: item.date,
    day: shortDay(item.date),
    tasks: item.tasks_done,
    focus: item.focus_minutes,
    created: item.notes_created + item.reminders_created,
  }))
}
