import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import { appendPagination, type PaginationParams } from "@/types/common.types"
import {
  focusSessionResponseSchema,
  focusSessionsResponseSchema,
  focusStatsResponseSchema,
  type CreateFocusSessionInput,
  type FocusSessionFilters,
  type FocusSessionResponse,
  type FocusSessionsResponse,
  type FocusStatsResponse,
} from "@/types/focus.types"

export const focusQueryKeys = {
  all: ["focus"] as const,
  sessions: (filters: FocusSessionFilters, pagination?: PaginationParams) => ["focus", "sessions", filters, pagination] as const,
  stats: ["focus", "stats"] as const,
}

export function useFocusStats() {
  return useQuery({
    queryKey: focusQueryKeys.stats,
    queryFn: () =>
      apiFetch<FocusStatsResponse>("/api/v1/focus/stats", {
        schema: focusStatsResponseSchema,
      }),
  })
}

export function useFocusSessions(filters: FocusSessionFilters, pagination?: PaginationParams) {
  return useQuery({
    queryKey: focusQueryKeys.sessions(filters, pagination),
    queryFn: () =>
      apiFetch<FocusSessionsResponse>(`/api/v1/focus/sessions${focusQueryString(filters, pagination)}`, {
        schema: focusSessionsResponseSchema,
      }),
  })
}

export function useCreateFocusSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateFocusSessionInput) =>
      apiFetch<FocusSessionResponse>("/api/v1/focus/sessions", {
        method: "POST",
        body: normalizeCreateFocusSessionInput(input),
        schema: focusSessionResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: focusQueryKeys.all }),
  })
}

function focusQueryString(filters: FocusSessionFilters, pagination?: PaginationParams): string {
  const params = new URLSearchParams()
  if (filters.dateFrom) params.set("date_from", filters.dateFrom)
  if (filters.dateTo) params.set("date_to", filters.dateTo)
  if (filters.topicId) params.set("topic_id", filters.topicId)
  const query = appendPagination(params, pagination).toString()
  return query ? `?${query}` : ""
}

function normalizeCreateFocusSessionInput(input: CreateFocusSessionInput): CreateFocusSessionInput {
  return {
    ...input,
    topic_id: input.topic_id ?? "",
  }
}
