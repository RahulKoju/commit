import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import { authResponseSchema, type AuthResponse } from "@/types/auth.types"

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
