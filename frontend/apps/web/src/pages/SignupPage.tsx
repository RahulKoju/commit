import { useState, type FormEvent } from "react"

import { SignupForm } from "@/components/signup-form"
import { register } from "@/lib/auth"

export function SignupPage() {
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get("name") ?? "")
    const email = String(formData.get("email") ?? "")
    const password = String(formData.get("password") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    try {
      await register(name, email, password)
      window.location.assign(`${import.meta.env.VITE_APP_URL}/dashboard`)
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to create account"
      )
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm">
        <SignupForm onSubmit={onSubmit}>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </SignupForm>
      </div>
    </main>
  )
}
