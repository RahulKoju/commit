import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  noteResponseSchema,
  notesResponseSchema,
  type CreateNoteInput,
  type NoteResponse,
  type NotesResponse,
  type UpdateNoteInput,
} from "@/types/note.types"

export const noteQueryKeys = {
  all: ["notes"] as const,
  list: (search: string) => ["notes", search] as const,
}

export function useNotes(search: string) {
  return useQuery({
    queryKey: noteQueryKeys.list(search),
    queryFn: () =>
      apiFetch<NotesResponse>(`/api/v1/notes${notesQueryString(search)}`, {
        schema: notesResponseSchema,
      }),
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateNoteInput) =>
      apiFetch<NoteResponse>("/api/v1/notes", {
        method: "POST",
        body: input,
        schema: noteResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteQueryKeys.all }),
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateNoteInput }) =>
      apiFetch<NoteResponse>(`/api/v1/notes/${id}`, {
        method: "PATCH",
        body: input,
        schema: noteResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteQueryKeys.all }),
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<undefined>(`/api/v1/notes/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteQueryKeys.all }),
  })
}

function notesQueryString(search: string): string {
  const params = new URLSearchParams()
  if (search.trim()) params.set("search", search.trim())
  const query = params.toString()
  return query ? `?${query}` : ""
}
