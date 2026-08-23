import { BarChart3, Check, ChevronsUpDown, Clock, Maximize2, Minimize2, Pause, Play, RotateCcw, Search, Square, Target, TrendingUp } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useLocation } from "react-router-dom"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"

import { useActiveFocusSession, useCompleteActiveFocusSession, useDiscardActiveFocusSession, useFocusSessions, useFocusStats, usePauseActiveFocusSession, useResumeActiveFocusSession, useStartActiveFocusSession } from "@/hooks/useFocus"
import { useTasks } from "@/hooks/useTasks"
import { useFocusStore, sessionTypeLabel } from "@/store/useFocusStore"
import type { ActiveFocusSession, FocusSessionFilters } from "@/types/focus.types"
import type { Task } from "@/types/task.types"

const defaultDurations = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
}

const apiBaseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8080"

type FocusMachineState =
  | "idle"
  | "running_work"
  | "paused_work"
  | "running_break"
  | "paused_break"
  | "completing"
  | "transitioning"

type FocusPendingState = Extract<FocusMachineState, "completing" | "transitioning">

export function FocusPage() {
  const [workMinutes, setWorkMinutes] = useState(defaultDurations.work)
  const [shortBreakMinutes, setShortBreakMinutes] = useState(defaultDurations.shortBreak)
  const [longBreakMinutes, setLongBreakMinutes] = useState(defaultDurations.longBreak)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [durationErrors, setDurationErrors] = useState<Record<"work" | "shortBreak" | "longBreak", string | null>>({
    work: null,
    shortBreak: null,
    longBreak: null,
  })
  const [pendingState, setPendingState] = useState<FocusPendingState | null>(null)
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
  const tasksQuery = useTasks({ view: "active", status: "" }, { limit: 100 })
  const filters = useMemo<FocusSessionFilters>(() => ({ dateFrom, dateTo }), [dateFrom, dateTo])
  const sessionsQuery = useFocusSessions(filters)
  const statsQuery = useFocusStats()
  const selectedTask = tasksQuery.data?.data.find((task) => task.id === selectedTaskId)
  const completingRef = useRef(false)

  const active = session && (session.status === "running" || session.status === "paused") ? session : null
  const isRunning = active?.status === "running"
  const isPaused = active?.status === "paused"
  const focusState = deriveFocusState(active, pendingState)
  const activeTimerMode = active ? (active.planned_duration_seconds == null ? "stopwatch" : "pomodoro") : timerMode
  const kind = active ? sessionTypeLabel(active.session_type, activeTimerMode) : "idle"
  const isStopwatchWork = active?.session_type === "work" && active.planned_duration_seconds == null
  const showPomodoroControls = active ? activeTimerMode === "pomodoro" : timerMode === "pomodoro"
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
    if (!active || focusState !== "running_work" || active.planned_duration_seconds == null || isStopwatchWork) return
    if (displaySeconds > 0) return
    if (completingRef.current) return
    completingRef.current = true
    setPendingState("completing")
    completeActive.mutate(active.id, {
      onSuccess: () => {
        clearPreselectedTask()
        startBreak("short_break", { transitioning: true })
      },
      onError: (submitError: unknown) => {
        setError(submitError instanceof Error ? submitError.message : "Unable to complete session")
        setPendingState(null)
      },
      onSettled: () => {
        completingRef.current = false
      },
    })
  }, [active, displaySeconds, focusState, isStopwatchWork, completeActive, clearPreselectedTask])

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

  function startBreak(type: "short_break" | "long_break", options?: { transitioning?: boolean }) {
    setError(null)
    if (options?.transitioning) {
      setPendingState("transitioning")
    }
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
        onSettled: () => {
          if (options?.transitioning) {
            setPendingState(null)
          }
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
    if (timerMode === "pomodoro" && Object.values(durationErrors).some(Boolean)) {
      setError("Fix duration settings before starting a Pomodoro session.")
      return
    }
    startActive.mutate(
      {
        session_type: "work",
        task_id: selectedTaskId,
        planned_duration_seconds: timerMode === "stopwatch" ? undefined : workMinutes * 60,
      },
      {
        onSuccess: (response) => {
          setPendingState(null)
          applySession(response.session)
        },
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
            {activeTimerMode === "stopwatch" ? "Track time with a simple stopwatch." : "Run task-linked Pomodoro sessions and review focus history."}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex h-7 overflow-hidden rounded-lg border">
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
              <TaskPicker
                tasks={tasksQuery.data?.data ?? []}
                value={selectedTaskId}
                onChange={setSelectedTaskId}
                disabled={!!active}
              />
            </label>

            <div className="rounded-xl border bg-muted/40 p-8 text-center">
              <p className="text-sm text-muted-foreground">{timerStateLabel(focusState, isStopwatchWork ? "Elapsed time" : timerModeLabel(kind))}</p>
              <p className="mt-3 text-7xl font-semibold tabular-nums">{formatSeconds(displaySeconds)}</p>
              {active ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {pendingState ? "Updating" : isPaused ? "Paused" : "Running"}
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
                    <Button type="button" onClick={onStop} disabled={pendingState !== null}>
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
                    {timerMode === "stopwatch" ? "Start stopwatch" : "Start work"}
                  </Button>
                  {timerMode === "pomodoro" ? (
                    <>
                      <Button type="button" variant="outline" onClick={() => startBreak("short_break")}>
                        <Pause className="size-4" />
                        Short break
                      </Button>
                      <Button type="button" variant="outline" onClick={() => startBreak("long_break")}>
                        <Pause className="size-4" />
                        Long break
                      </Button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        {!isFullScreen && showPomodoroControls ? (
          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">Durations</h2>
            <div className="mt-4 grid gap-3">
              <NumberField
                label="Work"
                value={workMinutes}
                error={durationErrors.work}
                onChange={(value) => {
                  setWorkMinutes(value)
                  setDurationErrors((current) => ({ ...current, work: null }))
                }}
                onInvalid={(message) => setDurationErrors((current) => ({ ...current, work: message }))}
              />
              <NumberField
                label="Short break"
                value={shortBreakMinutes}
                error={durationErrors.shortBreak}
                onChange={(value) => {
                  setShortBreakMinutes(value)
                  setDurationErrors((current) => ({ ...current, shortBreak: null }))
                }}
                onInvalid={(message) => setDurationErrors((current) => ({ ...current, shortBreak: message }))}
              />
              <NumberField
                label="Long break"
                value={longBreakMinutes}
                error={durationErrors.longBreak}
                onChange={(value) => {
                  setLongBreakMinutes(value)
                  setDurationErrors((current) => ({ ...current, longBreak: null }))
                }}
                onInvalid={(message) => setDurationErrors((current) => ({ ...current, longBreak: message }))}
              />
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

function TaskPicker({
  tasks,
  value,
  onChange,
  disabled,
}: {
  tasks: Task[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = tasks.find((task) => task.id === value) ?? null

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return tasks
    return tasks.filter((task) => task.title.toLowerCase().includes(normalized))
  }, [tasks, query])

  useEffect(() => {
    if (!open) return
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(focusTimer)
  }, [open])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      setQuery("")
      setHighlighted(0)
    }
  }

  function selectTask(task: Task) {
    onChange(task.id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between font-normal"
          disabled={disabled}
        >
          <span className="truncate">{selected ? selected.title : "Select a task"}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlighted(0)
            }}
            placeholder="Type to search tasks..."
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setHighlighted((current) => Math.min(current + 1, filtered.length - 1))
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                setHighlighted((current) => Math.max(current - 1, 0))
              } else if (event.key === "Enter" && filtered[highlighted]) {
                event.preventDefault()
                selectTask(filtered[highlighted])
              }
            }}
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No tasks match.</p>
          ) : (
            filtered.map((task, index) => (
              <button
                key={task.id}
                type="button"
                onClick={() => selectTask(task)}
                onMouseEnter={() => setHighlighted(index)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                  index === highlighted ? "bg-muted" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                {task.id === value ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function NumberField({
  label,
  value,
  error,
  onChange,
  onInvalid,
}: {
  label: string
  value: number
  error: string | null
  onChange: (value: number) => void
  onInvalid: (message: string) => void
}) {
  const [displayValue, setDisplayValue] = useState(String(value))

  function handleChange(rawValue: string) {
    setDisplayValue(rawValue)
    if (rawValue.trim() === "") {
      onInvalid("Duration is required.")
      return
    }
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed) || parsed < 1) {
      onInvalid("Use at least 1 minute.")
      return
    }
    onChange(parsed)
  }

  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <input
        type="number"
        min={1}
        aria-invalid={!!error}
        className={`h-9 rounded-md border bg-background px-3 ${error ? "border-destructive" : ""}`}
        value={displayValue}
        onChange={(event) => handleChange(event.target.value)}
      />
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
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

function deriveFocusState(
  active: ActiveFocusSession | null,
  pendingState: FocusPendingState | null,
): FocusMachineState {
  if (pendingState) return pendingState
  if (!active) return "idle"
  const paused = active.status === "paused"
  if (active.session_type === "work") {
    return paused ? "paused_work" : "running_work"
  }
  return paused ? "paused_break" : "running_break"
}

function timerStateLabel(state: FocusMachineState, fallback: string): string {
  if (state === "completing") return "Completing interval"
  if (state === "transitioning") return "Starting break"
  return fallback
}
