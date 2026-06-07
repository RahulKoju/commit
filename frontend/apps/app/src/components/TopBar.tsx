import { LogOut, Menu } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

import { apiFetch } from "@/lib/api"
import { useCurrentUser } from "@/hooks/useAuth"

export function TopBar() {
  const { data } = useCurrentUser()
  const user = data?.user ?? null

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
      <Button type="button" variant="outline" onClick={logout}>
        <LogOut className="size-4" />
        Logout
      </Button>
    </header>
  )
}
