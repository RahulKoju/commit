import { Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"

import { useCreateFocusSession, useFocusSessions } from "@/hooks/useFocus"
import { useTasks } from "@/hooks/useTasks"
import { useFocusStore } from "@/store/useFocusStore"
import type { FocusSessionFilters } from "@/types/focus.types"

const defaultDurations = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
}

export function FocusPage() {
  const [workMinutes, setWorkMinutes] = useState(defaultDurations.work)
  const [shortBreakMinutes, setShortBreakMinutes] = useState(defaultDurations.shortBreak)
  const [longBreakMinutes, setLongBreakMinutes] = useState(defaultDurations.longBreak)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [topicId, setTopicId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const selectedTaskId = useFocusStore((state) => state.selectedTaskId)
  const setSelectedTaskId = useFocusStore((state) => state.setSelectedTaskId)
  const startedAt = useFocusStore((state) => state.startedAt)
  const remainingSeconds = useFocusStore((state) => state.remainingSeconds)
  const mode = useFocusStore((state) => state.mode)
  const isFullScreen = useFocusStore((state) => state.isFullScreen)
  const setIsFullScreen = useFocusStore((state) => state.setIsFullScreen)
  const startTimer = useFocusStore((state) => state.startTimer)
  const startBreak = useFocusStore((state) => state.startBreak)
  const resetTimer = useFocusStore((state) => state.resetTimer)
  const tick = useFocusStore((state) => state.tick)
  const createSession = useCreateFocusSession()
  const tasksQuery = useTasks({ view: "all", status: "" })
  const filters = useMemo<FocusSessionFilters>(
    () => ({ dateFrom, dateTo, topicId }),
    [dateFrom, dateTo, topicId]
  )
  const sessionsQuery = useFocusSessions(filters)
  const selectedTask = tasksQuery.data?.data.find((task) => task.id === selectedTaskId)
  const isRunning = mode === "work" || mode === "short-break" || mode === "long-break"
  const isWorkRunning = mode === "work"

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) return

    const interval = window.setInterval(() => tick(), 1000)
    return () => window.clearInterval(interval)
  }, [isRunning, remainingSeconds, tick])

  useEffect(() => {
    if (mode !== "work" || remainingSeconds !== 0 || !startedAt || !selectedTaskId) return

    createSession
      .mutateAsync({
        task_id: selectedTaskId,
        topic_id: selectedTask?.topic_id ?? "",
        start_time: new Date(startedAt).toISOString(),
        duration_minutes: workMinutes,
      })
      .then(() => startBreak(shortBreakMinutes * 60, "short-break"))
      .catch((submitError: unknown) => {
        setError(submitError instanceof Error ? submitError.message : "Unable to log session")
        resetTimer()
      })
  }, [
    createSession,
    mode,
    remainingSeconds,
    resetTimer,
    selectedTask?.topic_id,
    selectedTaskId,
    shortBreakMinutes,
    startBreak,
    startedAt,
    workMinutes,
  ])

  function onStart() {
    setError(null)
    if (!selectedTaskId) {
      setError("Select a task before starting a focus session.")
      return
    }
    startTimer(workMinutes * 60, Date.now())
  }

  function onHistorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setDateFrom(String(formData.get("dateFrom") ?? ""))
    setDateTo(String(formData.get("dateTo") ?? ""))
    setTopicId(String(formData.get("topicId") ?? ""))
  }

  const content = (
    <section className={isFullScreen ? "fixed inset-0 z-50 overflow-auto bg-background p-6" : "space-y-6"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Focus</h1>
          <p className="text-sm text-muted-foreground">
            Run task-linked Pomodoro sessions and review focus history.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setIsFullScreen(!isFullScreen)}>
          {isFullScreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          {isFullScreen ? "Exit full screen" : "Full screen"}
        </Button>
      </div>

      <div className={isFullScreen ? "mx-auto grid max-w-3xl gap-6 pt-16" : "grid gap-6 xl:grid-cols-[1fr_24rem]"}>
        <div className="rounded-xl border bg-background p-6">
          <div className="grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Task</span>
              <select
                className="h-10 rounded-md border bg-background px-3"
                value={selectedTaskId}
                onChange={(event) => setSelectedTaskId(event.target.value)}
                disabled={isWorkRunning}
              >
                <option value="">Select a task</option>
                {tasksQuery.data?.data
                  .filter((task) => task.status !== "done")
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
              </select>
            </label>

            <div className="rounded-xl border bg-muted/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">{timerModeLabel(mode)}</p>
              <p className="mt-3 text-7xl font-semibold tabular-nums">{formatSeconds(remainingSeconds || workMinutes * 60)}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {selectedTask ? selectedTask.title : "No task selected"}
              </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={onStart} disabled={isRunning}>
                <Play className="size-4" />
                Start work
              </Button>
              <Button type="button" variant="outline" onClick={() => startBreak(shortBreakMinutes * 60, "short-break")}>
                <Pause className="size-4" />
                Short break
              </Button>
              <Button type="button" variant="outline" onClick={() => startBreak(longBreakMinutes * 60, "long-break")}>
                <Pause className="size-4" />
                Long break
              </Button>
              <Button type="button" variant="outline" onClick={resetTimer}>
                <RotateCcw className="size-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>

        {!isFullScreen ? (
          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">Durations</h2>
            <div className="mt-4 grid gap-3">
              <NumberField label="Work" value={workMinutes} onChange={setWorkMinutes} />
              <NumberField label="Short break" value={shortBreakMinutes} onChange={setShortBreakMinutes} />
              <NumberField label="Long break" value={longBreakMinutes} onChange={setLongBreakMinutes} />
            </div>
          </div>
        ) : null}
      </div>

      {!isFullScreen ? (
        <div className="rounded-xl border bg-background p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Session history</h2>
            <form className="flex flex-wrap gap-2" onSubmit={onHistorySubmit}>
              <input name="dateFrom" type="date" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="dateTo" type="date" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <input name="topicId" placeholder="Topic ID" className="h-9 rounded-md border bg-background px-3 text-sm" />
              <Button type="submit" variant="outline">Filter</Button>
            </form>
          </div>
          <div className="mt-4 grid gap-2">
            {sessionsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading sessions...</p> : null}
            {sessionsQuery.data?.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No focus sessions yet.</p>
            ) : null}
            {sessionsQuery.data?.data.map((session) => (
              <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{session.task_title}</p>
                  <p className="text-muted-foreground">{new Date(session.start_time).toLocaleString()}</p>
                </div>
                <span className="font-medium">{session.duration_minutes} min</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )

  return content
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        min={1}
        className="h-9 rounded-md border bg-background px-3"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function formatSeconds(value: number): string {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function timerModeLabel(mode: "idle" | "work" | "short-break" | "long-break"): string {
  if (mode === "work") return "Work interval"
  if (mode === "short-break") return "Short break"
  if (mode === "long-break") return "Long break"
  return "Ready"
}
