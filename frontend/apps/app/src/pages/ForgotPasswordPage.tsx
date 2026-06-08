import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"

import { Button } from "@workspace/ui/components/button"

import { useForgotPassword } from "@/hooks/useAuth"

export function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await forgotPassword.mutateAsync(email)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            If an account with that email exists, a reset link has been sent.
          </p>
          <Link to="/login" className="block text-sm text-muted-foreground underline">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Forgot password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email to receive a reset link.
          </p>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-md border bg-background px-3"
            />
          </label>
          {forgotPassword.isError ? (
            <p className="text-sm text-destructive">{forgotPassword.error.message}</p>
          ) : null}
          <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
            {forgotPassword.isPending ? "Sending..." : "Send reset link"}
          </Button>
        </form>
        <Link to="/login" className="block text-center text-sm text-muted-foreground underline">
          Back to login
        </Link>
      </div>
    </div>
  )
}
