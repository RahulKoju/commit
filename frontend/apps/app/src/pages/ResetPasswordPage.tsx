import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"

import { Button } from "@workspace/ui/components/button"

import { useResetPassword } from "@/hooks/useAuth"

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const resetPassword = useResetPassword()
  const [newPassword, setNewPassword] = useState("")
  const [done, setDone] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await resetPassword.mutateAsync({ token, new_password: newPassword })
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Password reset</h1>
          <p className="text-sm text-muted-foreground">
            Your password has been reset successfully.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Back to login</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Invalid reset link</h1>
          <p className="text-sm text-muted-foreground">
            No reset token found in the URL. Please request a new reset link.
          </p>
          <Button asChild className="w-full">
            <Link to="/forgot-password">Request reset link</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">New password</span>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="h-10 rounded-md border bg-background px-3"
            />
          </label>
          {resetPassword.isError ? (
            <p className="text-sm text-destructive">{resetPassword.error.message}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
            {resetPassword.isPending ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      </div>
    </div>
  )
}
