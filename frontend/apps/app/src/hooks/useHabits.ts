import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  habitAnalyticsResponseSchema,
  habitCategoriesResponseSchema,
  habitCategoryResponseSchema,
  habitLogResponseSchema,
  habitResponseSchema,
  habitsResponseSchema,
  type CreateHabitCategoryInput,
  type CreateHabitInput,
  type HabitAnalyticsResponse,
  type HabitCategoriesResponse,
  type HabitCategoryResponse,
  type HabitLogResponse,
  type HabitResponse,
  type HabitsResponse,
  type LogHabitInput,
  type UpdateHabitInput,
} from "@/types/habit.types"

export const habitQueryKeys = {
  all: ["habits"] as const,
  categories: ["habits", "categories"] as const,
  analytics: (id: string) => ["habits", id, "analytics"] as const,
}

export function useHabits() {
  return useQuery({
    queryKey: habitQueryKeys.all,
    queryFn: () =>
      apiFetch<HabitsResponse>("/api/v1/habits", {
        schema: habitsResponseSchema,
      }),
  })
}

export function useHabitCategories() {
  return useQuery({
    queryKey: habitQueryKeys.categories,
    queryFn: () =>
      apiFetch<HabitCategoriesResponse>("/api/v1/habit-categories", {
        schema: habitCategoriesResponseSchema,
      }),
  })
}

export function useCreateHabitCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateHabitCategoryInput) =>
      apiFetch<HabitCategoryResponse>("/api/v1/habit-categories", {
        method: "POST",
        body: input,
        schema: habitCategoryResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitQueryKeys.categories }),
  })
}

export function useCreateHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateHabitInput) =>
      apiFetch<HabitResponse>("/api/v1/habits", {
        method: "POST",
        body: input,
        schema: habitResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitQueryKeys.all }),
  })
}

export function useUpdateHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ habitId, input }: { habitId: string; input: UpdateHabitInput }) =>
      apiFetch<HabitResponse>(`/api/v1/habits/${habitId}`, {
        method: "PATCH",
        body: input,
        schema: habitResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitQueryKeys.all }),
  })
}

export function useDeleteHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (habitId: string) =>
      apiFetch(`/api/v1/habits/${habitId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitQueryKeys.all }),
  })
}

export function useLogHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ habitId, input }: { habitId: string; input: LogHabitInput }) =>
      apiFetch<HabitLogResponse>(`/api/v1/habits/${habitId}/log`, {
        method: "POST",
        body: input,
        schema: habitLogResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitQueryKeys.all }),
  })
}

export function useHabitAnalytics(id: string) {
  return useQuery({
    queryKey: habitQueryKeys.analytics(id),
    queryFn: () =>
      apiFetch<HabitAnalyticsResponse>(`/api/v1/habits/${id}/analytics`, {
        schema: habitAnalyticsResponseSchema,
      }),
    enabled: Boolean(id),
  })
}
