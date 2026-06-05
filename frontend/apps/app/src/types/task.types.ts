import { z } from "zod"

export const taskStatusSchema = z.enum(["todo", "in-progress", "done"])
export const taskPrioritySchema = z.enum(["low", "medium", "high"])
export const taskViewSchema = z.enum(["today", "backlog", "completed", "all"])

export const taskSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  topic_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string(),
  priority: taskPrioritySchema,
  scheduled_date: z.string().nullable(),
  status: taskStatusSchema,
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const tasksResponseSchema = z.object({
  tasks: z.array(taskSchema),
})

export const taskResponseSchema = z.object({
  task: taskSchema,
})

export type TaskStatus = z.infer<typeof taskStatusSchema>
export type TaskPriority = z.infer<typeof taskPrioritySchema>
export type TaskView = z.infer<typeof taskViewSchema>
export type Task = z.infer<typeof taskSchema>
export type TasksResponse = z.infer<typeof tasksResponseSchema>
export type TaskResponse = z.infer<typeof taskResponseSchema>

export type TaskFilters = {
  view: TaskView
  topicId?: string
  priority?: TaskPriority | ""
  status?: TaskStatus | ""
}

export type CreateTaskInput = {
  topic_id?: string
  title: string
  description: string
  priority: TaskPriority
  scheduled_date?: string
  status: TaskStatus
}

export type UpdateTaskInput = Partial<CreateTaskInput>
