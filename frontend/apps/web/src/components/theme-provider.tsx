import { useEffect, type ReactNode } from "react"

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    document.documentElement.classList.remove("light")
    document.documentElement.classList.add("dark")
  }, [])

  return <>{children}</>
}
