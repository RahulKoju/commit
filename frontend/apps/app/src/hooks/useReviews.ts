import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  reviewResponseSchema,
  reviewsResponseSchema,
  type CreateReviewInput,
  type ReviewResponse,
  type ReviewType,
  type ReviewsResponse,
} from "@/types/review.types"

export const reviewQueryKeys = {
  all: ["reviews"] as const,
  list: (type: ReviewType | "") => ["reviews", type] as const,
  detail: (id: string) => ["reviews", "detail", id] as const,
}

export function useReviews(type: ReviewType | "") {
  return useQuery({
    queryKey: reviewQueryKeys.list(type),
    queryFn: () =>
      apiFetch<ReviewsResponse>(`/api/v1/reviews${reviewsQueryString(type)}`, {
        schema: reviewsResponseSchema,
      }),
  })
}

export function useReview(id: string) {
  return useQuery({
    queryKey: reviewQueryKeys.detail(id),
    queryFn: () =>
      apiFetch<ReviewResponse>(`/api/v1/reviews/${id}`, {
        schema: reviewResponseSchema,
      }),
    enabled: Boolean(id),
  })
}

export function useCreateReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateReviewInput) =>
      apiFetch<ReviewResponse>("/api/v1/reviews", {
        method: "POST",
        body: input,
        schema: reviewResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reviewQueryKeys.all }),
  })
}

function reviewsQueryString(type: ReviewType | ""): string {
  if (!type) {
    return ""
  }
  const params = new URLSearchParams()
  params.set("type", type)
  return `?${params.toString()}`
}
