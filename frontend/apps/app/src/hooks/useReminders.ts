import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  reminderResponseSchema,
  remindersResponseSchema,
  type CreateReminderInput,
  type ReminderResponse,
  type RemindersResponse,
  type UpdateReminderInput,
} from "@/types/reminder.types"

export const reminderQueryKeys = {
  all: ["reminders"] as const,
  byNote: (noteId: string) => ["reminders", "note", noteId] as const,
  due: (since: string) => ["reminders", "due", since] as const,
}

export function useRemindersByNote(noteId: string | null) {
  return useQuery({
    queryKey: reminderQueryKeys.byNote(noteId ?? ""),
    queryFn: () =>
      apiFetch<RemindersResponse>(`/api/v1/notes/${noteId}/reminders`, {
        schema: remindersResponseSchema,
      }),
    enabled: !!noteId,
  })
}

export function useCreateReminder(noteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReminderInput) =>
      apiFetch<ReminderResponse>(`/api/v1/notes/${noteId}/reminders`, {
        method: "POST",
        body: input,
        schema: reminderResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reminderQueryKeys.all }),
  })
}

export function useUpdateReminder(noteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateReminderInput }) =>
      apiFetch<ReminderResponse>(`/api/v1/notes/${noteId}/reminders/${id}`, {
        method: "PATCH",
        body: input,
        schema: reminderResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reminderQueryKeys.all }),
  })
}

export function useDeleteReminder(noteId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<undefined>(`/api/v1/notes/${noteId}/reminders/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reminderQueryKeys.all }),
  })
}

// useDueReminders polls the due endpoint in a caller-managed interval
// (set up in the notification hook). `since` lets the client catch up on
// anything that fired while it was away.
export function useDueReminders(since?: string) {
  return useQuery({
    queryKey: reminderQueryKeys.due(since ?? ""),
    queryFn: () =>
      apiFetch<RemindersResponse>(
        `/api/v1/reminders/due${since ? `?since=${encodeURIComponent(since)}` : ""}`,
        { schema: remindersResponseSchema }
      ),
    enabled: false,
    refetchInterval: false,
  })
}