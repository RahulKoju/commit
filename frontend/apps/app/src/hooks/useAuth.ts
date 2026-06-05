import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"

import { apiFetch } from "@/lib/api"
import { useAuthStore } from "@/store/useAuthStore"
import { authResponseSchema, type AuthResponse } from "@/types/auth.types"

export const authQueryKeys = {
  me: ["auth", "me"] as const,
}

export function useCurrentUser() {
  const setUser = useAuthStore((state) => state.setUser)
  const query = useQuery({
    queryKey: authQueryKeys.me,
    queryFn: () =>
      apiFetch<AuthResponse>("/api/v1/auth/me", { schema: authResponseSchema }),
  })

  useEffect(() => {
    if (query.data) {
      setUser(query.data.user)
    }
  }, [query.data, setUser])

  return query
}
