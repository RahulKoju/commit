import { BarChart3, Clock, Maximize2, Minimize2, Pause, Play, RotateCcw, Square, Target, TrendingUp } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useLocation } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"

import { useActiveFocusSession, useCompleteActiveFocusSession, useDiscardActiveFocusSession, useFocusSessions, useFocusStats, usePauseActiveFocusSession, useResumeActiveFocusSession, useStartActiveFocusSession } from "@/hooks/useFocus"
import { useTasks } from "@/hooks/useTasks"
import { useFocusStore, sessionTypeLabel } from "@/store/useFocusStore"
import type { FocusSessionFilters } from "@/types/focus.types"

const defaultDurations = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
}

const apiBaseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8080"

export function FocusPage() {
  const [workMinutes, setWorkMinutes] = useState(defaultDurations.work)
  const [shortBreakMinutes, setShortBreakMinutes] = useState(defaultDurations.shortBreak)
  const [longBreakMinutes, setLongBreakMinutes] = useState(defaultDurations.longBreak)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()
  const selectedTaskId = useFocusStore((state) => state.selectedTaskId)
  const setSelectedTaskId = useFocusStore((state) => state.setSelectedTaskId)
  const elapsedSeconds = useFocusStore((state) => state.elapsedSeconds)
  const session = useFocusStore((state) => state.session)
  const timerMode = useFocusStore((state) => state.timerMode)
  const setTimerMode = useFocusStore((state) => state.setTimerMode)
  const isFullScreen = useFocusStore((state) => state.isFullScreen)
  const setIsFullScreen = useFocusStore((state) => state.setIsFullScreen)
  const preselectedTaskTitle = useFocusStore((state) => state.preselectedTaskTitle)
  const setPreselectedTask = useFocusStore((state) => state.setPreselectedTask)
  const clearPreselectedTask = useFocusStore((state) => state.clearPreselectedTask)
  const hydrate = useFocusStore((state) => state.hydrate)
  const applySession = useFocusStore((state) => state.applySession)
  const clearSession = useFocusStore((state) => state.clearSession)
  const pauseLocal = useFocusStore((state) => state.pauseLocal)
  const resumeLocal = useFocusStore((state) => state.resumeLocal)
  const tick = useFocusStore((state) => state.tick)
  const activeQuery = useActiveFocusSession()
  const startActive = useStartActiveFocusSession()
  const pauseActive = usePauseActiveFocusSession()
  const resumeActive = useResumeActiveFocusSession()
  const completeActive = useCompleteActiveFocusSession()
  const discardActive = useDiscardActiveFocusSession()
  const tasksQuery = useTasks({ view: "all", status: "" })
  const filters = useMemo<FocusSessionFilters>(() => ({ dateFrom, dateTo }), [dateFrom, dateTo])
  const sessionsQuery = useFocusSessions(filters)
  const statsQuery = useFocusStats()
  const selectedTask = tasksQuery.data?.data.find((task) => task.id === selectedTaskId)
  const completingRef = useRef(false)

  const active = session && (session.status === "running" || session.status === "paused") ? session : null
  const isRunning = active?.status === "running"
  const isPaused = active?.status === "paused"
  const kind = active ? sessionTypeLabel(active.session_type, timerMode) : "idle"
  const isStopwatchWork = active?.session_type === "work" && active.planned_duration_seconds == null
  const displaySeconds =
    active?.planned_duration_seconds == null ? elapsedSeconds : Math.max(0, active.planned_duration_seconds - elapsedSeconds)

  useEffect(() => {
    const state = location.state as { taskId?: string; taskTitle?: string } | null
    if (state?.taskId) {
      setSelectedTaskId(state.taskId)
      setPreselectedTask(state.taskId, state.taskTitle ?? "")
      window.history.replaceState({}, "")
    }
  }, [location.state, setSelectedTaskId, setPreselectedTask])

  // Hydrate the store from the server on mount / refresh / device switch.
  useEffect(() => {
    if (activeQuery.isSuccess) {
      hydrate(activeQuery.data)
    }
  }, [activeQuery.isSuccess, activeQuery.data, hydrate])

  // Local 1s ticking for a smooth countdown; reconciled against server truth
  // on every mutation response and each tick re-derives from the anchor.
  useEffect(() => {
    if (!isRunning) return
    const interval = window.setInterval(() => tick(), 1000)
    return () => window.clearInterval(interval)
  }, [isRunning, tick])

  // Auto-complete a pomodoro work session at 0, then auto-start the short break.
  useEffect(() => {
    if (!active || active.session_type !== "work" || active.planned_duration_seconds == null || isPaused) return
    if (displaySeconds > 0) return
    if (completingRef.current) return
    completingRef.current = true
    completeActive.mutate(active.id, {
      onSuccess: () => {
        clearPreselectedTask()
        startBreak("short_break")
      },
      onError: (submitError: unknown) => {
        setError(submitError instanceof Error ? submitError.message : "Unable to complete session")
      },
      onSettled: () => {
        completingRef.current = false
      },
    })
  }, [active, displaySeconds, isPaused, completeActive, clearPreselectedTask])

  // Heartbeat while running: keep the server's liveness window open. Fired
  // every 20s; failures are swallowed (the scheduler's grace window covers
  // hiccups, and tab-close is handled by the sendBeacon pause below).
  useEffect(() => {
    if (!isRunning || !active) return
    const sessionID = active.id
    const ping = () => {
      void fetch(`${apiBaseURL}/api/v1/focus/sessions/heartbeat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionID }),
      }).catch(() => undefined)
    }
    ping()
    const interval = window.setInterval(ping, 20_000)
    return () => window.clearInterval(interval)
  }, [isRunning, active?.id])

  // sendBeacon pause on pagehide (reliable across mobile/bfcache, unlike
  // beforeunload). text/plain body so sendBeacon doesn't need custom headers;
  // the httpOnly auth cookie rides along on the same-origin request.
  useEffect(() => {
    if (!isRunning || !active) return
    const sessionID = active.id
    const onPageHide = () => {
      navigator.sendBeacon(`${apiBaseURL}/api/v1/focus/sessions/pause`, new Blob([sessionID], { type: "text/plain" }))
    }
    window.addEventListener("pagehide", onPageHide)
    return () => window.removeEventListener("pagehide", onPageHide)
  }, [isRunning, active?.id])

  function startBreak(type: "short_break" | "long_break") {
    setError(null)
    startActive.mutate(
      {
        session_type: type,
        planned_duration_seconds: (type === "short_break" ? shortBreakMinutes : longBreakMinutes) * 60,
      },
      {
        onSuccess: (response) => applySession(response.session),
        onError: (submitError: unknown) => {
          setError(submitError instanceof Error ? submitError.message : "Unable to start break")
        },
      }
    )
  }

  function onStart() {
    setError(null)
    if (!selectedTaskId) {
      setError("Select a task before starting a focus session.")
      return
    }
    startActive.mutate(
      {
        session_type: "work",
        task_id: selectedTaskId,
        planned_duration_seconds: timerMode === "stopwatch" ? undefined : workMinutes * 60,
      },
      {
        onSuccess: (response) => applySession(response.session),
        onError: (submitError: unknown) => {
          const err = submitError as Error & { status?: number }
          setError(err.status === 409 ? "An active focus session already exists; resume or finish it first." : err.message || "Unable to start session")
          if (err.status === 409) {
            void activeQuery.refetch()
          }
        },
      }
    )
  }

  function onPause() {
    if (!active) return
    pauseLocal()
    pauseActive.mutate(active.id, {
      onSuccess: (response) => applySession(response.session),
      onError: () => void activeQuery.refetch(),
    })
  }

  function onResume() {
    if (!active) return
    resumeLocal()
    resumeActive.mutate(active.id, {
      onSuccess: (response) => applySession(response.session),
      onError: () => void activeQuery.refetch(),
    })
  }

  function onStop() {
    if (!active || active.session_type !== "work") return
    completeActive.mutate(active.id, {
      onSuccess: () => {
        clearPreselectedTask()
        clearSession()
      },
      onError: (submitError: unknown) => {
        setError(submitError instanceof Error ? submitError.message : "Unable to log session")
        void activeQuery.refetch()
      },
    })
  }

  function onDiscard() {
    if (!active) return
    discardActive.mutate(active.id, {
      onSuccess: () => {
        clearPreselectedTask()
        clearSession()
      },
      onError: (submitError: unknown) => {
        setError(submitError instanceof Error ? submitError.message : "Unable to discard session")
        void activeQuery.refetch()
      },
    })
  }

  function onHistorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setDateFrom(String(formData.get("dateFrom") ?? ""))
    setDateTo(String(formData.get("dateTo") ?? ""))
  }

  const content = (
    <section className={isFullScreen ? "fixed inset-0 z-50 overflow-auto bg-background p-6" : "space-y-6"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Focus</h1>
          <p className="text-sm text-muted-foreground">
            {timerMode === "stopwatch" ? "Track time with a simple stopwatch." : "Run task-linked Pomodoro sessions and review focus history."}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex overflow-hidden rounded-lg border">
            <Button
              type="button"
              size="sm"
              variant={timerMode === "pomodoro" ? "default" : "ghost"}
              className="rounded-none border-0"
              onClick={() => setTimerMode("pomodoro")}
              disabled={!!active}
            >
              Pomodoro
            </Button>
            <Button
              type="button"
              size="sm"
              variant={timerMode === "stopwatch" ? "default" : "ghost"}
              className="rounded-none border-0"
              onClick={() => setTimerMode("stopwatch")}
              disabled={!!active}
            >
              Stopwatch
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={() => setIsFullScreen(!isFullScreen)}>
            {isFullScreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            {isFullScreen ? "Exit full screen" : "Full screen"}
          </Button>
        </div>
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
                disabled={!!active}
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
              <p className="text-sm text-muted-foreground">{isStopwatchWork ? "Elapsed time" : timerModeLabel(kind)}</p>
              <p className="mt-3 text-7xl font-semibold tabular-nums">{formatSeconds(displaySeconds)}</p>
              {active ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {isPaused ? "Paused" : "Running"}
                  {active.session_type !== "work" ? ` · ${active.session_type === "short_break" ? "Short break" : "Long break"}` : ""}
                </p>
              ) : preselectedTaskTitle ? (
                <p className="mt-3 text-sm font-medium text-primary">Focusing on: {preselectedTaskTitle}</p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{selectedTask ? selectedTask.title : "No task selected"}</p>
              )}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap justify-center gap-2">
              {active ? (
                <>
                  {isRunning ? (
                    <Button type="button" variant="outline" onClick={onPause}>
                      <Pause className="size-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={onResume}>
                      <Play className="size-4" />
                      Resume
                    </Button>
                  )}
                  {active.session_type === "work" && isStopwatchWork ? (
                    <Button type="button" onClick={onStop}>
                      <Square className="size-4" />
                      Stop
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={onDiscard}>
                    <RotateCcw className="size-4" />
                    Discard
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" onClick={onStart}>
                    <Play className="size-4" />
                    Start work
                  </Button>
                  <Button type="button" variant="outline" onClick={() => startBreak("short_break")}>
                    <Pause className="size-4" />
                    Short break
                  </Button>
                  <Button type="button" variant="outline" onClick={() => startBreak("long_break")}>
                    <Pause className="size-4" />
                    Long break
                  </Button>
                </>
              )}
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
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">Stats</h2>
            {statsQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading stats...</p> : null}
            {statsQuery.data?.stats ? (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4" />
                    <span>Total time</span>
                  </div>
                  <p className="mt-1 text-xl font-semibold">{Math.round(statsQuery.data.stats.total_minutes / 60)}h</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BarChart3 className="size-4" />
                    <span>Sessions</span>
                  </div>
                  <p className="mt-1 text-xl font-semibold">{statsQuery.data.stats.total_sessions}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="size-4" />
                    <span>Avg session</span>
                  </div>
                  <p className="mt-1 text-xl font-semibold">{Math.round(statsQuery.data.stats.average_minutes)} min</p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Target className="size-4" />
                    <span>This week</span>
                  </div>
                  <p className="mt-1 text-xl font-semibold">{statsQuery.data.stats.current_week_minutes} min</p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Session history</h2>
              <form className="flex flex-wrap gap-2" onSubmit={onHistorySubmit}>
                <input name="dateFrom" type="date" className="h-9 rounded-md border bg-background px-3 text-sm" />
                <input name="dateTo" type="date" className="h-9 rounded-md border bg-background px-3 text-sm" />
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
                    {session.tags.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {session.tags.map((tag) => (
                          <span key={tag} className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="font-medium">{session.duration_minutes} min</span>
                </div>
              ))}
            </div>
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