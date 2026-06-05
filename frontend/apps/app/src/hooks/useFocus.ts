import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  focusSessionResponseSchema,
  focusSessionsResponseSchema,
  type CreateFocusSessionInput,
  type FocusSessionFilters,
  type FocusSessionResponse,
  type FocusSessionsResponse,
} from "@/types/focus.types"

export const focusQueryKeys = {
  all: ["focus"] as const,
  sessions: (filters: FocusSessionFilters) => ["focus", "sessions", filters] as const,
}

export function useFocusSessions(filters: FocusSessionFilters) {
  return useQuery({
    queryKey: focusQueryKeys.sessions(filters),
    queryFn: () =>
      apiFetch<FocusSessionsResponse>(`/api/v1/focus/sessions${focusQueryString(filters)}`, {
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

function focusQueryString(filters: FocusSessionFilters): string {
  const params = new URLSearchParams()
  if (filters.dateFrom) params.set("date_from", filters.dateFrom)
  if (filters.dateTo) params.set("date_to", filters.dateTo)
  if (filters.topicId) params.set("topic_id", filters.topicId)
  const query = params.toString()
  return query ? `?${query}` : ""
}

function normalizeCreateFocusSessionInput(input: CreateFocusSessionInput): CreateFocusSessionInput {
  return {
    ...input,
    topic_id: input.topic_id ?? "",
  }
}
