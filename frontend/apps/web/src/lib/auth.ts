import { apiFetch } from "@/lib/api"
import {
  authResponseSchema,
  forgotPasswordResponseSchema,
  resetPasswordResponseSchema,
  type AuthResponse,
  type ForgotPasswordResponse,
  type ResetPasswordResponse,
} from "@/types/auth.types"

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

export function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  return apiFetch<ForgotPasswordResponse>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: { email },
    schema: forgotPasswordResponseSchema,
  })
}

export function resetPassword(token: string, new_password: string): Promise<ResetPasswordResponse> {
  return apiFetch<ResetPasswordResponse>("/api/v1/auth/reset-password", {
    method: "POST",
    body: { token, new_password },
    schema: resetPasswordResponseSchema,
  })
}
