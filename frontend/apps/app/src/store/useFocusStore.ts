import { create } from "zustand"

type TimerMode = "pomodoro" | "stopwatch"

type FocusState = {
  isFullScreen: boolean
  selectedTaskId: string
  startedAt: number | null
  durationSeconds: number
  remainingSeconds: number
  elapsedSeconds: number
  mode: "idle" | "work" | "short-break" | "long-break"
  timerMode: TimerMode
  setIsFullScreen: (value: boolean) => void
  setSelectedTaskId: (value: string) => void
  setTimerMode: (value: TimerMode) => void
  startTimer: (durationSeconds: number, startedAt: number) => void
  tick: () => void
  resetTimer: () => void
  startBreak: (durationSeconds: number, mode: "short-break" | "long-break") => void
}

export const useFocusStore = create<FocusState>((set) => ({
  isFullScreen: false,
  selectedTaskId: "",
  startedAt: null,
  durationSeconds: 0,
  remainingSeconds: 0,
  elapsedSeconds: 0,
  mode: "idle",
  timerMode: "pomodoro",
  setIsFullScreen: (value) => set({ isFullScreen: value }),
  setSelectedTaskId: (value) => set({ selectedTaskId: value }),
  setTimerMode: (value) => set({ timerMode: value }),
  startTimer: (durationSeconds, startedAt) =>
    set({ durationSeconds, remainingSeconds: durationSeconds, elapsedSeconds: 0, startedAt, mode: "work" }),
  tick: () =>
    set((state) => {
      if (state.startedAt === null) return {}
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000)
      if (state.timerMode === "stopwatch") {
        return { elapsedSeconds: elapsed, remainingSeconds: Math.max(0, state.durationSeconds - elapsed) }
      }
      return { remainingSeconds: Math.max(0, state.durationSeconds - elapsed) }
    }),
  resetTimer: () =>
    set({ remainingSeconds: 0, elapsedSeconds: 0, startedAt: null, durationSeconds: 0, mode: "idle", isFullScreen: false }),
  startBreak: (durationSeconds, mode) =>
    set({ durationSeconds, remainingSeconds: durationSeconds, elapsedSeconds: 0, startedAt: Date.now(), mode }),
}))
