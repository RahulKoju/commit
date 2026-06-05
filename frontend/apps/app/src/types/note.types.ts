import { z } from "zod"

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
  created_at: z.string(),
  updated_at: z.string(),
})

export const notesResponseSchema = z.object({
  notes: z.array(noteSchema),
})

export const noteResponseSchema = z.object({
  note: noteSchema,
})

export type NoteTopic = z.infer<typeof noteTopicSchema>
export type Note = z.infer<typeof noteSchema>
export type NotesResponse = z.infer<typeof notesResponseSchema>
export type NoteResponse = z.infer<typeof noteResponseSchema>

export type CreateNoteInput = {
  title: string
  body: string
  topic_ids: string[]
}

export type UpdateNoteInput = Partial<CreateNoteInput>
