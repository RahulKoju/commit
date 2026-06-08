import { z } from "zod"
import { paginatedResponseSchema } from "./common.types"

export const noteTopicSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const noteSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  topics: z.array(noteTopicSchema),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
})

export const notesResponseSchema = paginatedResponseSchema(noteSchema)

export const noteResponseSchema = z.object({
  note: noteSchema,
})

export const noteLinkSchema = z.object({
  source_note_id: z.string().uuid(),
  target_note_id: z.string().uuid(),
  target_title: z.string(),
})

export const backlinksResponseSchema = z.object({
  backlinks: z.array(noteLinkSchema),
})

export type NoteTopic = z.infer<typeof noteTopicSchema>
export type Note = z.infer<typeof noteSchema>
export type NotesResponse = z.infer<typeof notesResponseSchema>
export type NoteResponse = z.infer<typeof noteResponseSchema>
export type NoteLink = z.infer<typeof noteLinkSchema>
export type BacklinksResponse = z.infer<typeof backlinksResponseSchema>

export type CreateNoteInput = {
  title: string
  body: string
  topic_ids: string[]
  tags: string[]
}

export type UpdateNoteInput = Partial<CreateNoteInput>
