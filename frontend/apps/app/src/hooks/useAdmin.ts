import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  adminUsersResponseSchema,
  type AdminUsersResponse,
} from "@/types/admin.types"

const adminQueryKeys = {
  users: ["admin", "users"] as const,
}

export function useAdminUsers() {
  return useQuery<AdminUsersResponse>({
    queryKey: adminQueryKeys.users,
    queryFn: () =>
      apiFetch<AdminUsersResponse>("/api/v1/admin/users", {
        schema: adminUsersResponseSchema,
      }),
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/api/v1/admin/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminQueryKeys.users }),
  })
}
