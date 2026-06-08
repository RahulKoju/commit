import { z } from "zod"

export const habitTypeSchema = z.enum(["boolean", "numeric"])
export const habitFrequencyTypeSchema = z.enum(["daily", "weekly"])

export const habitLogSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  habit_id: z.string().uuid(),
  logged_date: z.string(),
  value: z.number(),
  note: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const habitSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  category_id: z.string().uuid(),
  category_name: z.string(),
  name: z.string(),
  description: z.string(),
  type: habitTypeSchema,
  target_value: z.number().nullable(),
  target_unit: z.string().nullable(),
  frequency_type: habitFrequencyTypeSchema,
  frequency_days: z.array(z.number().int()),
  weekly_goal: z.number().int(),
  sort_order: z.number().int(),
  today_log: habitLogSchema.nullable(),
  current_streak: z.number().int(),
  longest_streak: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const habitCategorySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const habitDayStatusSchema = z.object({
  date: z.string(),
  value: z.number(),
  completed: z.boolean(),
})

export const habitAnalyticsSchema = z.object({
  habit_id: z.string().uuid(),
  completion_rate_30: z.number(),
  completion_rate_90: z.number(),
  current_streak: z.number().int(),
  longest_streak: z.number().int(),
  best_week: z.number().int(),
  daily_completion: z.array(habitDayStatusSchema),
  category_completion: z.number(),
})

export const habitsResponseSchema = z.object({
  habits: z.array(habitSchema),
})

export const habitResponseSchema = z.object({
  habit: habitSchema,
})

export const habitCategoriesResponseSchema = z.object({
  categories: z.array(habitCategorySchema),
})

export const habitCategoryResponseSchema = z.object({
  category: habitCategorySchema,
})

export const habitLogResponseSchema = z.object({
  log: habitLogSchema,
})

export const habitAnalyticsResponseSchema = z.object({
  analytics: habitAnalyticsSchema,
})

export type HabitType = z.infer<typeof habitTypeSchema>
export type HabitFrequencyType = z.infer<typeof habitFrequencyTypeSchema>
export type Habit = z.infer<typeof habitSchema>
export type HabitCategory = z.infer<typeof habitCategorySchema>
export type HabitLog = z.infer<typeof habitLogSchema>
export type HabitAnalytics = z.infer<typeof habitAnalyticsSchema>
export type HabitsResponse = z.infer<typeof habitsResponseSchema>
export type HabitResponse = z.infer<typeof habitResponseSchema>
export type HabitCategoriesResponse = z.infer<typeof habitCategoriesResponseSchema>
export type HabitCategoryResponse = z.infer<typeof habitCategoryResponseSchema>
export type HabitLogResponse = z.infer<typeof habitLogResponseSchema>
export type HabitAnalyticsResponse = z.infer<typeof habitAnalyticsResponseSchema>

export type CreateHabitCategoryInput = {
  name: string
}

export type UpdateHabitCategoryInput = {
  name: string
}

export type CreateHabitInput = {
  category_id: string
  name: string
  description: string
  type: HabitType
  target_value?: number
  target_unit?: string
  frequency_type: HabitFrequencyType
  frequency_days: number[]
  weekly_goal: number
  sort_order: number
}

export type UpdateHabitInput = {
  category_id?: string
  name?: string
  description?: string
  type?: HabitType
  target_value?: number
  target_unit?: string
  frequency_type?: HabitFrequencyType
  frequency_days?: number[]
  weekly_goal?: number
  sort_order?: number
}

export type LogHabitInput = {
  value: number
  logged_date: string
  note?: string
}
