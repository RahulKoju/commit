import { useMutation, useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  authResponseSchema,
  forgotPasswordResponseSchema,
  resetPasswordResponseSchema,
  type AuthResponse,
  type ForgotPasswordResponse,
  type ResetPasswordResponse,
} from "@/types/auth.types"

export const authQueryKeys = {
  me: ["auth", "me"] as const,
}

export function useCurrentUser() {
  return useQuery({
    queryKey: authQueryKeys.me,
    queryFn: () =>
      apiFetch<AuthResponse>("/api/v1/auth/me", { schema: authResponseSchema }),
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<ForgotPasswordResponse>("/api/v1/auth/forgot-password", {
        method: "POST",
        body: { email },
        schema: forgotPasswordResponseSchema,
      }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, new_password }: { token: string; new_password: string }) =>
      apiFetch<ResetPasswordResponse>("/api/v1/auth/reset-password", {
        method: "POST",
        body: { token, new_password },
        schema: resetPasswordResponseSchema,
      }),
  })
}
