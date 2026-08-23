import { z } from "zod"
import { paginatedResponseSchema } from "./common.types"

export const focusSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  task_id: z.string().uuid(),
  task_title: z.string(),
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

export const focusSessionTypeSchema = z.enum(["work", "short_break", "long_break"])

export const focusSessionStatusSchema = z.enum(["running", "paused", "completed", "discarded"])

export const activeFocusSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  task_id: z.string().uuid().nullable(),
  task_title: z.string(),
  session_type: focusSessionTypeSchema,
  status: focusSessionStatusSchema,
  elapsed_seconds: z.number().int(),
  planned_duration_seconds: z.number().int().nullable(),
  segment_started_at: z.string().nullable(),
  heartbeat_at: z.string(),
  started_at: z.string(),
  message: z.string(),
  tags: z.array(z.string()),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const activeFocusSessionResponseSchema = z.object({
  session: activeFocusSessionSchema.nullable(),
})

export const focusActiveSessionResponseSchema = z.object({
  session: activeFocusSessionSchema,
})

export type FocusSession = z.infer<typeof focusSessionSchema>
export type FocusSessionsResponse = z.infer<typeof focusSessionsResponseSchema>
export type FocusSessionResponse = z.infer<typeof focusSessionResponseSchema>
export type FocusStats = z.infer<typeof focusStatsSchema>
export type FocusStatsResponse = z.infer<typeof focusStatsResponseSchema>
export type FocusSessionType = z.infer<typeof focusSessionTypeSchema>
export type FocusSessionStatus = z.infer<typeof focusSessionStatusSchema>
export type ActiveFocusSession = z.infer<typeof activeFocusSessionSchema>
export type ActiveFocusSessionResponse = z.infer<typeof activeFocusSessionResponseSchema>

export type FocusSessionFilters = {
  dateFrom?: string
  dateTo?: string
}

export type StartActiveFocusInput = {
  session_type: FocusSessionType
  task_id?: string
  planned_duration_seconds?: number
  tags?: string[]
  message?: string
}