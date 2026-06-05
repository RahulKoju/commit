import { z } from "zod"

export const reviewTypeSchema = z.enum(["weekly", "monthly"])

export const reviewDataSchema = z.object({
  habit_hits: z.array(
    z.object({
      habit_id: z.string().uuid(),
      habit_name: z.string(),
      category_name: z.string(),
      logged_days: z.number().int(),
      completed_days: z.number().int(),
      trend: z.string(),
    })
  ),
  tasks_completed: z.number().int(),
  total_study_hours: z.number(),
  focus_sessions_count: z.number().int(),
  total_focus_hours: z.number(),
  top_studied_topics: z.array(
    z.object({
      topic_id: z.string().uuid(),
      topic_name: z.string(),
      total_minutes: z.number().int(),
    })
  ),
  best_habit: z.string().nullable(),
  most_missed_habit: z.string().nullable(),
})

export const reviewSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: reviewTypeSchema,
  period_start: z.string(),
  period_end: z.string(),
  reflection_text: z.string(),
  data: reviewDataSchema,
  created_at: z.string(),
  updated_at: z.string(),
})

export const reviewsResponseSchema = z.object({
  reviews: z.array(reviewSchema),
})

export const reviewResponseSchema = z.object({
  review: reviewSchema,
})

export type ReviewType = z.infer<typeof reviewTypeSchema>
export type ReviewData = z.infer<typeof reviewDataSchema>
export type Review = z.infer<typeof reviewSchema>
export type ReviewsResponse = z.infer<typeof reviewsResponseSchema>
export type ReviewResponse = z.infer<typeof reviewResponseSchema>

export type CreateReviewInput = {
  type: ReviewType
  period_start?: string
  period_end?: string
  reflection_text: string
}
