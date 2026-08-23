import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import { appendPagination, type PaginationParams } from "@/types/common.types"
import {
  activeFocusSessionResponseSchema,
  focusActiveSessionResponseSchema,
  focusSessionsResponseSchema,
  focusStatsResponseSchema,
  type ActiveFocusSession,
  type ActiveFocusSessionResponse,
  type FocusSessionFilters,
  type FocusSessionsResponse,
  type FocusStatsResponse,
  type StartActiveFocusInput,
} from "@/types/focus.types"

export const focusQueryKeys = {
  all: ["focus"] as const,
  active: ["focus", "active"] as const,
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

export function useActiveFocusSession() {
  return useQuery({
    queryKey: focusQueryKeys.active,
    queryFn: () =>
      apiFetch<ActiveFocusSessionResponse>("/api/v1/focus/active", {
        schema: activeFocusSessionResponseSchema,
      }).then((response) => response.session),
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

export function useStartActiveFocusSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: StartActiveFocusInput) =>
      apiFetch<{ session: ActiveFocusSession }>("/api/v1/focus/sessions/start", {
        method: "POST",
        body: input,
        schema: focusActiveSessionResponseSchema,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(focusQueryKeys.active, response.session)
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function usePauseActiveFocusSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionID: string) =>
      apiFetch<{ session: ActiveFocusSession }>("/api/v1/focus/sessions/pause", {
        method: "POST",
        body: { session_id: sessionID },
        schema: focusActiveSessionResponseSchema,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(focusQueryKeys.active, response.session)
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useResumeActiveFocusSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionID: string) =>
      apiFetch<{ session: ActiveFocusSession }>("/api/v1/focus/sessions/resume", {
        method: "POST",
        body: { session_id: sessionID },
        schema: focusActiveSessionResponseSchema,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(focusQueryKeys.active, response.session)
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useCompleteActiveFocusSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionID: string) =>
      apiFetch<{ session: ActiveFocusSession }>("/api/v1/focus/sessions/complete", {
        method: "POST",
        body: { session_id: sessionID },
        schema: focusActiveSessionResponseSchema,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(focusQueryKeys.active, response.session)
      void queryClient.invalidateQueries({ queryKey: focusQueryKeys.all })
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useDiscardActiveFocusSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionID: string) =>
      apiFetch<{ session: ActiveFocusSession }>("/api/v1/focus/sessions/discard", {
        method: "POST",
        body: { session_id: sessionID },
        schema: focusActiveSessionResponseSchema,
      }),
    onSuccess: (response) => {
      queryClient.setQueryData(focusQueryKeys.active, response.session)
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

function focusQueryString(filters: FocusSessionFilters, pagination?: PaginationParams): string {
  const params = new URLSearchParams()
  if (filters.dateFrom) params.set("date_from", filters.dateFrom)
  if (filters.dateTo) params.set("date_to", filters.dateTo)
  const query = appendPagination(params, pagination).toString()
  return query ? `?${query}` : ""
}