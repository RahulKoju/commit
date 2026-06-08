import {
  BarChart3,
  BookCopy,
  BookOpen,
  CheckSquare,
  History,
  LayoutDashboard,
  NotebookPen,
  Shield,
  Target,
} from "lucide-react"
import { NavLink } from "react-router-dom"
import { Logo } from "@workspace/ui/components/logo"

import { useCurrentUser } from "@/hooks/useAuth"

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/focus", label: "Focus", icon: Target },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/habits", label: "Habits", icon: BarChart3 },
  { to: "/notes", label: "Notes", icon: NotebookPen },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/learn/flashcards", label: "Flashcards", icon: BookCopy },
  { to: "/reviews", label: "Reviews", icon: History },
]

export function Sidebar() {
  const currentUser = useCurrentUser()
  const isAdmin = currentUser.data?.user.role === "admin"

  return (
    <aside className="hidden min-h-svh w-64 border-r bg-background lg:block">
      <div className="border-b px-5 py-4">
        <Logo />
      </div>
      <nav className="space-y-1 p-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/learn"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <link.icon className="size-4" />
            {link.label}
          </NavLink>
        ))}
        {isAdmin ? (
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <Shield className="size-4" />
            Admin
          </NavLink>
        ) : null}
      </nav>
    </aside>
  )
}
