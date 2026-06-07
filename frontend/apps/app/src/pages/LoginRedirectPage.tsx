import { useEffect, useRef, useState } from "react"
import { Navigate } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080"
const webUrl = import.meta.env.VITE_WEB_URL ?? "http://localhost:5173"

export function LoginRedirectPage() {
  const [state, setState] = useState<"loading" | "authenticated" | "guest">("loading")
  const hasRedirected = useRef(false)

  useEffect(() => {
    axios
      .get(`${apiUrl}/api/v1/auth/me`, { withCredentials: true })
      .then(() => {
        if (hasRedirected.current) return
        hasRedirected.current = true
        toast.info("You are already logged in. Redirecting to dashboard.")
        setTimeout(() => setState("authenticated"), 300)
      })
      .catch(() => {
        if (hasRedirected.current) return
        hasRedirected.current = true
        toast.error("Please log in to continue.")
        setTimeout(() => {
          window.location.assign(`${webUrl}/login`)
        }, 500)
      })
  }, [])

  if (state === "authenticated") {
    return <Navigate replace to="/dashboard" />
  }

  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Loading...
    </div>
  )
}
