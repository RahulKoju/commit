import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { forgotPassword } from "@/lib/auth"

export function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setFormError(null)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "")

    try {
      await forgotPassword(email)
      setSent(true)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to send reset link"
      const status = (submitError as Error & { status?: number }).status
      setFormError(message)
      if (status && status >= 500) {
        toast.error(`${status} ${message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-sm text-balance text-muted-foreground">
          If an account with that email exists, a reset link has been sent.
        </p>
        <Link to="/login" className="text-sm text-muted-foreground underline underline-offset-4">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">Forgot password</h1>
        <p className="text-sm text-balance text-muted-foreground">
          Enter your email to receive a reset link.
        </p>
      </div>
      <div className="flex flex-col gap-4">
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
        </div>
        {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/login" className="underline underline-offset-4">Back to login</Link>
      </p>
    </form>
  )
}
