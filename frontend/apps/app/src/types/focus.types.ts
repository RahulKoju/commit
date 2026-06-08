import { z } from "zod"
import { paginatedResponseSchema } from "./common.types"

export const focusSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  task_id: z.string().uuid(),
  task_title: z.string(),
  topic_id: z.string().uuid().nullable(),
  tags: z.array(z.string()),
  start_time: z.string(),
  duration_minutes: z.number().int().positive(),
  created_at: z.string(),
})

export const focusSessionsResponseSchema = paginatedResponseSchema(focusSessionSchema)

export const focusSessionResponseSchema = z.object({
  session: focusSessionSchema,
})

export const focusStatsSchema = z.object({
  total_sessions: z.number().int(),
  total_minutes: z.number().int(),
  average_minutes: z.number(),
  current_week_minutes: z.number().int(),
  last_week_minutes: z.number().int(),
  longest_session: z.number().int(),
  session_days: z.number().int(),
})

export const focusStatsResponseSchema = z.object({
  stats: focusStatsSchema,
})

export type FocusSession = z.infer<typeof focusSessionSchema>
export type FocusSessionsResponse = z.infer<typeof focusSessionsResponseSchema>
export type FocusSessionResponse = z.infer<typeof focusSessionResponseSchema>
export type FocusStats = z.infer<typeof focusStatsSchema>
export type FocusStatsResponse = z.infer<typeof focusStatsResponseSchema>

export type FocusSessionFilters = {
  dateFrom?: string
  dateTo?: string
  topicId?: string
}

export type CreateFocusSessionInput = {
  task_id: string
  topic_id?: string
  tags?: string[]
  start_time: string
  duration_minutes: number
}
