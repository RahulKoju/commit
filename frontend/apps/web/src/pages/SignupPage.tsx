import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { register } from "@/lib/auth"

export function SignupPage() {
  const [loading, setLoading] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setNameError(null)
    setEmailError(null)
    setPasswordError(null)
    setConfirmError(null)

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get("name") ?? "")
    const email = String(formData.get("email") ?? "")
    const password = String(formData.get("password") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")

    if (!name.trim()) {
      setNameError("Name is required")
      setLoading(false)
      return
    }

    if (!email.trim()) {
      setEmailError("Email is required")
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setPasswordError("Must be at least 8 characters")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match")
      setLoading(false)
      return
    }

    try {
      await register(name, email, password)
      toast.success("Account created successfully")
      window.location.assign(`${import.meta.env.VITE_APP_URL ?? "http://localhost:5174"}/dashboard`)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to create account"
      const status = (submitError as Error & { status?: number }).status
      const lower = message.toLowerCase()
      if (status && status >= 500) {
        setFormError(message)
        toast.error(`${status} ${message}`)
      } else if (lower.includes("email") && (lower.includes("already") || lower.includes("exists") || lower.includes("registered") || lower.includes("duplicate"))) {
        setEmailError(message)
      } else if (lower.includes("name")) {
        setNameError(message)
      } else if (lower.includes("password")) {
        setPasswordError(message)
      } else {
        setEmailError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-balance text-muted-foreground">
          Fill in the form below to create your account
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">Full Name</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="John Doe"
            required
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {emailError ? <p className="text-xs text-destructive">{emailError}</p> : null}
          {!emailError ? <p className="text-xs text-muted-foreground">We&apos;ll use this to contact you. We will not share your email with anyone else.</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {passwordError ? <p className="text-xs text-destructive">{passwordError}</p> : null}
          {!passwordError ? <p className="text-xs text-muted-foreground">Must be at least 8 characters long.</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            required
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {confirmError ? <p className="text-xs text-destructive">{confirmError}</p> : null}
          {!confirmError ? <p className="text-xs text-muted-foreground">Please confirm your password.</p> : null}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </div>
      <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
        <span className="relative z-10 bg-background px-2 text-muted-foreground">Already committed?</span>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="underline underline-offset-4">Sign in</Link>
      </p>
    </form>
  )
}
