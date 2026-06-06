import { BookOpen, CheckCircle2, Clock, Flame, NotebookPen, Target } from "lucide-react"
import type { ComponentType } from "react"
import { Link } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"

import { useCurrentUser } from "@/hooks/useAuth"
import { useDashboardSummary } from "@/hooks/useDashboard"
import type { DashboardSummary } from "@/types/dashboard.types"

export function DashboardPage() {
  const { data } = useCurrentUser()
  const user = data?.user ?? null
  const dashboardQuery = useDashboardSummary()
  const summary = dashboardQuery.data?.summary

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatDate(summary?.today)}</p>
          <h1 className="text-2xl font-semibold">Hello, {user?.name ?? "developer"}</h1>
        </div>
        <Button asChild>
          <Link to="/focus">
            <Target className="size-4" />
            Start focus
          </Link>
        </Button>
      </div>

      {dashboardQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading dashboard...</p> : null}
      {summary ? <DashboardWidgets summary={summary} /> : null}
    </section>
  )
}

function DashboardWidgets({ summary }: { summary: DashboardSummary }) {
  const taskPercent = percent(summary.task_summary.done, summary.task_summary.total)
  const habitPercent = percent(summary.habit_summary.checked, summary.habit_summary.total)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CheckCircle2}
          label="Today's tasks"
          value={`${summary.task_summary.done}/${summary.task_summary.total}`}
          detail={`${taskPercent}% complete`}
          href="/tasks"
        />
        <MetricCard
          icon={Flame}
          label="Today's habits"
          value={`${summary.habit_summary.checked}/${summary.habit_summary.total}`}
          detail={`${habitPercent}% checked`}
          href="/habits"
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
          value={summary.active_focus_session ? `${summary.active_focus_session.duration_minutes} min` : "Ready"}
          detail={summary.active_focus_session?.task_title ?? "Start a session"}
          href="/focus"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="rounded-xl border bg-background p-4">
          <h2 className="font-semibold">Weekly habit completion</h2>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {summary.weekly_habit_chart.map((item) => (
              <div key={item.date} className="grid gap-2 text-center text-xs">
                <div className="flex h-32 items-end rounded-lg bg-muted px-2">
                  <div
                    className="w-full rounded-md bg-primary"
                    style={{ height: `${Math.max(6, percent(item.checked, item.total))}%` }}
                  />
                </div>
                <span className="text-muted-foreground">{shortDay(item.date)}</span>
                <span className="font-medium">{item.checked}/{item.total}</span>
              </div>
            ))}
          </div>
        </div>

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
              <Link key={note.id} to="/notes" className="rounded-lg border p-3 text-sm hover:bg-muted/50">
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
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  href,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  detail: string
  href: string
}) {
  return (
    <Link to={href} className="rounded-xl border bg-background p-4 hover:bg-muted/50">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </Link>
  )
}

function percent(done: number, total: number): number {
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

function formatDate(value: string | undefined): string {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
}

function shortDay(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { weekday: "short" })
}
