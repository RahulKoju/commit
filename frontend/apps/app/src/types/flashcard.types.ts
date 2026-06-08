import { z } from "zod"

export const flashcardSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  topic_id: z.string().uuid().nullable(),
  topic_name: z.string(),
  front: z.string(),
  back: z.string(),
  ease_factor: z.number(),
  interval_days: z.number().int(),
  repetitions: z.number().int(),
  next_review_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const flashcardListResponseSchema = z.object({
  data: z.array(flashcardSchema),
})

export const flashcardDueResponseSchema = z.object({
  data: z.array(flashcardSchema),
})

export const flashcardCreateResponseSchema = z.object({
  card: flashcardSchema,
})

export const flashcardUpdateResponseSchema = z.object({
  card: flashcardSchema,
})

export const flashcardReviewResponseSchema = z.object({
  card: flashcardSchema,
})

export type Flashcard = z.infer<typeof flashcardSchema>
export type FlashcardListResponse = z.infer<typeof flashcardListResponseSchema>
export type FlashcardDueResponse = z.infer<typeof flashcardDueResponseSchema>
export type FlashcardCreateResponse = z.infer<typeof flashcardCreateResponseSchema>
export type FlashcardUpdateResponse = z.infer<typeof flashcardUpdateResponseSchema>
export type FlashcardReviewResponse = z.infer<typeof flashcardReviewResponseSchema>
