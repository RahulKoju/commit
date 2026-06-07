import { useEffect, useRef, useState } from "react"
import { Link, Outlet } from "react-router-dom"
import axios from "axios"
import { toast } from "sonner"
import { Logo } from "@workspace/ui/components/logo"

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8080"
const appUrl = import.meta.env.VITE_APP_URL ?? "http://localhost:5174"

export function AuthLayout() {
  const [checking, setChecking] = useState(true)
  const hasRedirected = useRef(false)

  useEffect(() => {
    axios
      .get(`${apiUrl}/api/v1/auth/me`, { withCredentials: true })
      .then(() => {
        if (hasRedirected.current) return
        hasRedirected.current = true
        toast.info("You are already logged in. Redirecting to dashboard.")
        setTimeout(() => {
          window.location.assign(`${appUrl}/dashboard`)
        }, 500)
      })
      .catch(() => {
        setChecking(false)
      })
  }, [])

  if (checking) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <Outlet />
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <img
          src="/image.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  )
}
