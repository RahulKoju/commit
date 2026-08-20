import { z } from "zod"

export const dashboardTaskSummarySchema = z.object({
  total: z.number().int(),
  done: z.number().int(),
})

export const dashboardHabitSummarySchema = z.object({
  total: z.number().int(),
  checked: z.number().int(),
})

export const dashboardNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  updated_at: z.string(),
})

export const dashboardHabitChartItemSchema = z.object({
  date: z.string(),
  total: z.number().int(),
  checked: z.number().int(),
})

export const dashboardProductivityChartItemSchema = z.object({
  date: z.string(),
  tasks_done: z.number().int(),
  focus_minutes: z.number().int(),
  notes_created: z.number().int(),
  reminders_created: z.number().int(),
})

export const dashboardWeekComparisonSchema = z.object({
  tasks_done_this_week: z.number().int(),
  tasks_done_last_week: z.number().int(),
  habits_checked_this_week: z.number().int(),
  habits_checked_last_week: z.number().int(),
  focus_minutes_this_week: z.number().int(),
  focus_minutes_last_week: z.number().int(),
})

export const dashboardFocusSessionSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid().nullable(),
  task_title: z.string(),
  start_time: z.string(),
  duration_minutes: z.number().int(),
})

export const dashboardSummarySchema = z.object({
  today: z.string(),
  task_summary: dashboardTaskSummarySchema,
  habit_summary: dashboardHabitSummarySchema,
  recent_notes: z.array(dashboardNoteSchema),
  weekly_habit_chart: z.array(dashboardHabitChartItemSchema),
  weekly_productivity: z.array(dashboardProductivityChartItemSchema),
  week_comparison: dashboardWeekComparisonSchema,
  active_focus_session: dashboardFocusSessionSchema.nullable(),
})

export const dashboardSummaryResponseSchema = z.object({
  summary: dashboardSummarySchema,
})

export const habitHeatmapItemSchema = z.object({
  date: z.string(),
  total: z.number().int(),
  completed: z.number().int(),
})

export const activityHeatmapItemSchema = z.object({
  date: z.string(),
  points: z.number().int(),
  level: z.number().int(),
})

export const dashboardHeatmapResponseSchema = z.object({
  habit_heatmap: z.array(habitHeatmapItemSchema),
  activity_heatmap: z.array(activityHeatmapItemSchema),
})

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>
export type HabitHeatmapItem = z.infer<typeof habitHeatmapItemSchema>
export type ActivityHeatmapItem = z.infer<typeof activityHeatmapItemSchema>
export type DashboardHeatmapResponse = z.infer<typeof dashboardHeatmapResponseSchema>

export const dashboardLayoutResponseSchema = z.object({
  layout: z.array(z.string()).nullable(),
})

export type DashboardLayoutResponse = z.infer<typeof dashboardLayoutResponseSchema>
