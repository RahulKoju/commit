import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { resetPassword } from "@/lib/auth"

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setFormError(null)

    const formData = new FormData(event.currentTarget)
    const newPassword = String(formData.get("new_password") ?? "")

    try {
      await resetPassword(token, newPassword)
      setDone(true)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to reset password"
      const status = (submitError as Error & { status?: number }).status
      setFormError(message)
      if (status && status >= 500) {
        toast.error(`${status} ${message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold">Password reset</h1>
        <p className="text-sm text-balance text-muted-foreground">
          Your password has been reset successfully.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Back to login
        </Link>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold">Invalid reset link</h1>
        <p className="text-sm text-balance text-muted-foreground">
          No reset token found in the URL. Please request a new reset link.
        </p>
        <Link
          to="/forgot-password"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Request reset link
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">Set new password</h1>
        <p className="text-sm text-balance text-muted-foreground">
          Choose a new password for your account.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new_password" className="text-sm font-medium">New password</label>
          <input
            id="new_password"
            name="new_password"
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </div>
    </form>
  )
}
