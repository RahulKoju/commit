import { z } from "zod"
import { paginatedResponseSchema } from "./common.types"

export const learningTopicSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const learnEntrySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  topic_id: z.string().uuid(),
  topic_name: z.string(),
  duration_minutes: z.number().int().positive(),
  confidence: z.number().int().min(1).max(5),
  note: z.string(),
  studied_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const weakSpotSchema = z.object({
  topic_id: z.string().uuid(),
  topic_name: z.string(),
  average_confidence: z.number(),
  last_studied_at: z.string(),
})

export const topicStatsSchema = z.object({
  topic_id: z.string().uuid(),
  topic_name: z.string(),
  total_minutes: z.number().int(),
  average_confidence: z.number(),
  last_studied_at: z.string(),
})

export const studyDaySchema = z.object({
  date: z.string(),
  total_minutes: z.number().int(),
})

export const topicsResponseSchema = z.object({
  topics: z.array(learningTopicSchema),
})

export const topicResponseSchema = z.object({
  topic: learningTopicSchema,
})

export const learnEntriesResponseSchema = paginatedResponseSchema(learnEntrySchema)

export const learnEntryResponseSchema = z.object({
  entry: learnEntrySchema,
})

export const weakSpotsResponseSchema = z.object({
  weak_spots: z.array(weakSpotSchema),
})

export const learnSummaryResponseSchema = z.object({
  weak_spots: z.array(weakSpotSchema),
  topic_stats: z.array(topicStatsSchema),
  study_days: z.array(studyDaySchema),
  streak: z.number().int().nonnegative(),
})

export type LearningTopic = z.infer<typeof learningTopicSchema>
export type LearnEntry = z.infer<typeof learnEntrySchema>
export type WeakSpot = z.infer<typeof weakSpotSchema>
export type TopicStats = z.infer<typeof topicStatsSchema>
export type StudyDay = z.infer<typeof studyDaySchema>
export type TopicsResponse = z.infer<typeof topicsResponseSchema>
export type TopicResponse = z.infer<typeof topicResponseSchema>
export type LearnEntriesResponse = z.infer<typeof learnEntriesResponseSchema>
export type LearnEntryResponse = z.infer<typeof learnEntryResponseSchema>
export type WeakSpotsResponse = z.infer<typeof weakSpotsResponseSchema>
export type LearnSummaryResponse = z.infer<typeof learnSummaryResponseSchema>

export type CreateTopicInput = {
  name: string
}

export type CreateLearnEntryInput = {
  topic_id: string
  duration_minutes: number
  confidence: number
  note: string
  studied_at: string
}
