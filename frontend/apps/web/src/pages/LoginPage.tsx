import { useState, type FormEvent } from "react"

import { LoginForm } from "@/components/login-form"
import { login } from "@/lib/auth"

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "")
    const password = String(formData.get("password") ?? "")

    try {
      await login(email, password)
      window.location.assign(`${import.meta.env.VITE_APP_URL}/dashboard`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to login")
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm">
        <LoginForm onSubmit={onSubmit}>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </LoginForm>
      </div>
    </main>
  )
}
