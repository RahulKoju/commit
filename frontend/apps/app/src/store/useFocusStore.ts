import { create } from "zustand"

import type { ActiveFocusSession, FocusSessionType } from "@/types/focus.types"

type TimerMode = "pomodoro" | "stopwatch"

type FocusState = {
  isFullScreen: boolean
  selectedTaskId: string
  timerMode: TimerMode
  preselectedTaskId: string | null
  preselectedTaskTitle: string | null
  // session is the server truth snapshot; elapsedSeconds is the locally
  // computed display value reconciled against it.
  session: ActiveFocusSession | null
  elapsedSeconds: number
  isHydrated: boolean
  setIsFullScreen: (value: boolean) => void
  setSelectedTaskId: (value: string) => void
  setTimerMode: (value: TimerMode) => void
  setPreselectedTask: (taskId: string, taskTitle: string) => void
  clearPreselectedTask: () => void
  hydrate: (session: ActiveFocusSession | null) => void
  applySession: (session: ActiveFocusSession) => void
  clearSession: () => void
  pauseLocal: () => void
  resumeLocal: () => void
  tick: () => void
}

// sessionType derives the "kind" of the active timer for UI labels, mapping
// break session types to break labels.
export function sessionTypeLabel(sessionType: FocusSessionType | null, timerMode: TimerMode): "idle" | "work" | "short-break" | "long-break" {
  if (!sessionType) return "idle"
  if (sessionType === "work") return "work"
  if (sessionType === "short_break") return "short-break"
  if (sessionType === "long_break") return "long-break"
  return timerMode === "stopwatch" ? "work" : "idle"
}

export const useFocusStore = create<FocusState>((set, get) => ({
  isFullScreen: false,
  selectedTaskId: "",
  timerMode: "pomodoro",
  preselectedTaskId: null,
  preselectedTaskTitle: null,
  session: null,
  elapsedSeconds: 0,
  isHydrated: false,

  setIsFullScreen: (value) => set({ isFullScreen: value }),
  setSelectedTaskId: (value) => set({ selectedTaskId: value }),
  setTimerMode: (value) => set({ timerMode: value }),
  setPreselectedTask: (taskId, taskTitle) => set({ preselectedTaskId: taskId, preselectedTaskTitle: taskTitle }),
  clearPreselectedTask: () => set({ preselectedTaskId: null, preselectedTaskTitle: null }),

  hydrate: (session) =>
    set((state) => ({
      session,
      isHydrated: true,
      selectedTaskId: session?.task_id ?? state.selectedTaskId,
      elapsedSeconds: session ? session.elapsed_seconds : 0,
    })),

  applySession: (session) =>
    set((state) => ({
      session,
      selectedTaskId: session.task_id ?? state.selectedTaskId,
      elapsedSeconds: session.elapsed_seconds,
      // once the server owns the session, a stale preselection is consumed
      preselectedTaskId: state.preselectedTaskId === session.task_id ? null : state.preselectedTaskId,
      preselectedTaskTitle: state.preselectedTaskId === session.task_id ? null : state.preselectedTaskTitle,
    })),

  clearSession: () => set({ session: null, elapsedSeconds: 0 }),

  pauseLocal: () => {
    const { session, elapsedSeconds } = get()
    if (!session || session.status !== "running" || !session.segment_started_at) return
    set({
      session: {
        ...session,
        status: "paused",
        elapsed_seconds: elapsedSeconds,
        segment_started_at: null,
      },
      elapsedSeconds,
    })
  },

  resumeLocal: () => {
    const { session } = get()
    if (!session || session.status !== "paused") return
    set({
      session: {
        ...session,
        status: "running",
        segment_started_at: new Date().toISOString(),
      },
    })
  },

  tick: () => {
    const { session } = get()
    if (!session) return
    const running = session.status === "running" && session.segment_started_at
    const elapsed = running
      ? session.elapsed_seconds + Math.floor((Date.now() - new Date(session.segment_started_at as string).getTime()) / 1000)
      : session.elapsed_seconds
    set({ elapsedSeconds: elapsed })
  },
}))