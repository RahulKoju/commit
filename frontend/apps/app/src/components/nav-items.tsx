import {
  BarChart3,
  CheckSquare,
  LayoutDashboard,
  NotebookPen,
  Shield,
  Target,
} from "lucide-react"
import { NavLink } from "react-router-dom"

import { useCurrentUser } from "@/hooks/useAuth"

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/focus", label: "Focus", icon: Target },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/habits", label: "Habits", icon: BarChart3 },
  { to: "/notes", label: "Notes", icon: NotebookPen },
]

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`

export function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const currentUser = useCurrentUser()
  const isAdmin = currentUser.data?.user.role === "admin"

  return (
    <>
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.to === "/learn"} onClick={onNavigate} className={linkClassName}>
          <link.icon className="size-4" />
          {link.label}
        </NavLink>
      ))}
      {isAdmin ? (
        <NavLink to="/admin/users" onClick={onNavigate} className={linkClassName}>
          <Shield className="size-4" />
          Admin
        </NavLink>
      ) : null}
    </>
  )
}