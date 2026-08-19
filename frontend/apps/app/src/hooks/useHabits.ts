import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  habitAnalyticsResponseSchema,
  habitCategoriesResponseSchema,
  habitCategoryResponseSchema,
  habitLogResponseSchema,
  habitMatrixResponseSchema,
  habitResponseSchema,
  habitsResponseSchema,
  type CreateHabitCategoryInput,
  type CreateHabitInput,
  type HabitAnalyticsResponse,
  type HabitCategoriesResponse,
  type HabitCategoryResponse,
  type HabitLogResponse,
  type HabitMatrixResponse,
  type HabitResponse,
  type HabitsResponse,
  type LogHabitInput,
  type UpdateHabitCategoryInput,
  type UpdateHabitInput,
} from "@/types/habit.types"

export const habitQueryKeys = {
  all: ["habits"] as const,
  categories: ["habits", "categories"] as const,
  matrix: (start: string, end: string) => ["habits", "matrix", start, end] as const,
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

export function useHabitMatrix(start: string, end: string) {
  return useQuery({
    queryKey: habitQueryKeys.matrix(start, end),
    queryFn: () =>
      apiFetch<HabitMatrixResponse>(
        `/api/v1/habits/matrix?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { schema: habitMatrixResponseSchema },
      ),
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

export function useUpdateHabitCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: UpdateHabitCategoryInput }) =>
      apiFetch<HabitCategoryResponse>(`/api/v1/habit-categories/${categoryId}`, {
        method: "PATCH",
        body: input,
        schema: habitCategoryResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitQueryKeys.categories }),
  })
}

export function useDeleteHabitCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (categoryId: string) =>
      apiFetch(`/api/v1/habit-categories/${categoryId}`, { method: "DELETE" }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ["habits", "matrix"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard", "activity-heatmap"] })
    },
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
