import { apiFetch } from "@/lib/api"
import { authResponseSchema, type AuthResponse } from "@/types/auth.types"

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
    schema: authResponseSchema,
  })
}

export function register(
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: { name, email, password },
    schema: authResponseSchema,
  })
}
