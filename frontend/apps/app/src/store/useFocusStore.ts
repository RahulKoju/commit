import { create } from "zustand"

type FocusState = {
  isFullScreen: boolean
  setIsFullScreen: (value: boolean) => void
}

export const useFocusStore = create<FocusState>((set) => ({
  isFullScreen: false,
  setIsFullScreen: (value) => set({ isFullScreen: value }),
}))
