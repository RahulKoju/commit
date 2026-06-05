import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  taskResponseSchema,
  tasksResponseSchema,
  type CreateTaskInput,
  type TaskFilters,
  type TaskResponse,
  type TasksResponse,
  type UpdateTaskInput,
} from "@/types/task.types"

export const taskQueryKeys = {
  all: ["tasks"] as const,
  list: (filters: TaskFilters) => ["tasks", filters] as const,
}

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: taskQueryKeys.list(filters),
    queryFn: () =>
      apiFetch<TasksResponse>(`/api/v1/tasks${taskQueryString(filters)}`, {
        schema: tasksResponseSchema,
      }),
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiFetch<TaskResponse>("/api/v1/tasks", {
        method: "POST",
        body: normalizeCreateTaskInput(input),
        schema: taskResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskQueryKeys.all }),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      apiFetch<TaskResponse>(`/api/v1/tasks/${id}`, {
        method: "PATCH",
        body: normalizeUpdateTaskInput(input),
        schema: taskResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskQueryKeys.all }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<undefined>(`/api/v1/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskQueryKeys.all }),
  })
}

function taskQueryString(filters: TaskFilters): string {
  const params = new URLSearchParams()
  params.set("view", filters.view)
  if (filters.topicId) params.set("topic_id", filters.topicId)
  if (filters.priority) params.set("priority", filters.priority)
  if (filters.status) params.set("status", filters.status)
  return `?${params.toString()}`
}

function normalizeCreateTaskInput(input: CreateTaskInput): CreateTaskInput {
  return {
    ...input,
    topic_id: input.topic_id ?? "",
    scheduled_date: input.scheduled_date ?? "",
  }
}

function normalizeUpdateTaskInput(input: UpdateTaskInput): UpdateTaskInput {
  return {
    ...input,
    topic_id: input.topic_id ?? "",
    scheduled_date: input.scheduled_date ?? "",
  }
}
