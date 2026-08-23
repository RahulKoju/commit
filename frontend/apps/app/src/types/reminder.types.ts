import { z } from "zod"

export const reminderSchema = z.object({
  id: z.string().uuid(),
  note_id: z.string().uuid(),
  note_title: z.string(),
  type: z.enum(["one_time", "recurring"]),
  next_fire_at: z.string(),
  cron: z.string().nullable(),
  message: z.string(),
  is_active: z.boolean(),
  last_fired_at: z.string().nullable(),
  done_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const remindersResponseSchema = z.object({
  reminders: z.array(reminderSchema),
})

export const reminderResponseSchema = z.object({
  reminder: reminderSchema,
})

export type Reminder = z.infer<typeof reminderSchema>
export type RemindersResponse = z.infer<typeof remindersResponseSchema>
export type ReminderResponse = z.infer<typeof reminderResponseSchema>

export type CreateReminderInput = {
  type: "one_time" | "recurring"
  fire_at?: string
  cron?: string
  message: string
}

export type UpdateReminderInput = {
  cron?: string
  message?: string
  is_active?: boolean
}