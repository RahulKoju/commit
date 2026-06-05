import { create } from "zustand"

type FocusState = {
  isFullScreen: boolean
  selectedTaskId: string
  startedAt: string | null
  remainingSeconds: number
  mode: "idle" | "work" | "short-break" | "long-break"
  setIsFullScreen: (value: boolean) => void
  setSelectedTaskId: (value: string) => void
  startTimer: (durationSeconds: number, startedAt: string) => void
  tick: () => void
  resetTimer: () => void
  startBreak: (durationSeconds: number, mode: "short-break" | "long-break") => void
}

export const useFocusStore = create<FocusState>((set) => ({
  isFullScreen: false,
  selectedTaskId: "",
  startedAt: null,
  remainingSeconds: 0,
  mode: "idle",
  setIsFullScreen: (value) => set({ isFullScreen: value }),
  setSelectedTaskId: (value) => set({ selectedTaskId: value }),
  startTimer: (durationSeconds, startedAt) =>
    set({ remainingSeconds: durationSeconds, startedAt, mode: "work" }),
  tick: () =>
    set((state) => ({
      remainingSeconds: Math.max(0, state.remainingSeconds - 1),
    })),
  resetTimer: () => set({ remainingSeconds: 0, startedAt: null, mode: "idle", isFullScreen: false }),
  startBreak: (durationSeconds, mode) =>
    set({ remainingSeconds: durationSeconds, startedAt: null, mode }),
}))
