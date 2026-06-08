import { LogOut, Menu, Moon, Sun } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { apiFetch } from "@/lib/api"
import { useCurrentUser } from "@/hooks/useAuth"
import { useTheme } from "@/components/theme-provider"

export function TopBar() {
  const { data } = useCurrentUser()
  const user = data?.user ?? null
  const { theme, toggleTheme } = useTheme()

  async function logout() {
    await apiFetch<{ ok: boolean }>("/api/v1/auth/logout", { method: "POST" })
    window.location.assign(`${import.meta.env.VITE_WEB_URL ?? "http://localhost:5173"}/login`)
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      <Button type="button" variant="outline" size="icon" aria-label="Open navigation" className="lg:hidden">
        <Menu className="size-4" />
      </Button>
      <div>
        <p className="text-sm font-medium">{user?.name ?? "Commit"}</p>
        <p className="text-xs text-muted-foreground">{user?.email ?? "Loading account"}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
        <Button type="button" variant="outline" onClick={logout}>
          <LogOut className="size-4" />
          Logout
        </Button>
      </div>
    </header>
  )
}
