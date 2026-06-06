import { z } from "zod"
import { paginatedResponseSchema } from "./common.types"

export const focusSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  task_id: z.string().uuid(),
  task_title: z.string(),
  topic_id: z.string().uuid().nullable(),
  start_time: z.string(),
  duration_minutes: z.number().int().positive(),
  created_at: z.string(),
})

export const focusSessionsResponseSchema = paginatedResponseSchema(focusSessionSchema)

export const focusSessionResponseSchema = z.object({
  session: focusSessionSchema,
})

export type FocusSession = z.infer<typeof focusSessionSchema>
export type FocusSessionsResponse = z.infer<typeof focusSessionsResponseSchema>
export type FocusSessionResponse = z.infer<typeof focusSessionResponseSchema>

export type FocusSessionFilters = {
  dateFrom?: string
  dateTo?: string
  topicId?: string
}

export type CreateFocusSessionInput = {
  task_id: string
  topic_id?: string
  start_time: string
  duration_minutes: number
}
