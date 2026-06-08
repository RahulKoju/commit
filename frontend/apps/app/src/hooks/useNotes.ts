import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import { appendPagination, type PaginationParams } from "@/types/common.types"
import {
  backlinksResponseSchema,
  noteResponseSchema,
  notesResponseSchema,
  type BacklinksResponse,
  type CreateNoteInput,
  type NoteResponse,
  type NotesResponse,
  type UpdateNoteInput,
} from "@/types/note.types"

export const noteQueryKeys = {
  all: ["notes"] as const,
  list: (search: string, pagination?: PaginationParams) => ["notes", search, pagination] as const,
}

export function useNotes(search: string, pagination?: PaginationParams) {
  return useQuery({
    queryKey: noteQueryKeys.list(search, pagination),
    queryFn: () =>
      apiFetch<NotesResponse>(`/api/v1/notes${notesQueryString(search, pagination)}`, {
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

export function useNoteBacklinks(noteId: string | null) {
  return useQuery({
    queryKey: ["notes", "backlinks", noteId],
    queryFn: () =>
      apiFetch<BacklinksResponse>(`/api/v1/notes/${noteId}/backlinks`, {
        schema: backlinksResponseSchema,
      }),
    enabled: !!noteId,
  })
}

function notesQueryString(search: string, pagination?: PaginationParams): string {
  const params = new URLSearchParams()
  if (search.trim()) params.set("search", search.trim())
  const query = appendPagination(params, pagination).toString()
  return query ? `?${query}` : ""
}
