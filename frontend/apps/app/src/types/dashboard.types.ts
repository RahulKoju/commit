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
  habits_checked: z.number().int(),
  learning_sessions: z.number().int(),
})

export const dashboardFocusSessionSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().uuid(),
  task_title: z.string(),
  start_time: z.string(),
  duration_minutes: z.number().int(),
})

export const dashboardSummarySchema = z.object({
  today: z.string(),
  task_summary: dashboardTaskSummarySchema,
  habit_summary: dashboardHabitSummarySchema,
  learning_streak: z.number().int(),
  recent_notes: z.array(dashboardNoteSchema),
  weekly_habit_chart: z.array(dashboardHabitChartItemSchema),
  weekly_productivity: z.array(dashboardProductivityChartItemSchema),
  active_focus_session: dashboardFocusSessionSchema.nullable(),
})

export const dashboardSummaryResponseSchema = z.object({
  summary: dashboardSummarySchema,
})

export const activityHeatmapItemSchema = z.object({
  date: z.string(),
  total: z.number().int(),
  completed: z.number().int(),
})

export const activityHeatmapResponseSchema = z.object({
  heatmap: z.array(activityHeatmapItemSchema),
})

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>
export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>
export type ActivityHeatmapItem = z.infer<typeof activityHeatmapItemSchema>
export type ActivityHeatmapResponse = z.infer<typeof activityHeatmapResponseSchema>

export const dashboardLayoutResponseSchema = z.object({
  layout: z.array(z.string()).nullable(),
})

export type DashboardLayoutResponse = z.infer<typeof dashboardLayoutResponseSchema>
