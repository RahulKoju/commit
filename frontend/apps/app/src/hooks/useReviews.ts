import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import { appendPagination, type PaginationParams } from "@/types/common.types"
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
  list: (type: ReviewType | "", pagination?: PaginationParams) => ["reviews", type, pagination] as const,
  detail: (id: string) => ["reviews", "detail", id] as const,
}

export function useReviews(type: ReviewType | "", pagination?: PaginationParams) {
  return useQuery({
    queryKey: reviewQueryKeys.list(type, pagination),
    queryFn: () =>
      apiFetch<ReviewsResponse>(`/api/v1/reviews${reviewsQueryString(type, pagination)}`, {
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

function reviewsQueryString(type: ReviewType | "", pagination?: PaginationParams): string {
  if (!type && !pagination?.limit && !pagination?.offset) {
    return ""
  }
  const params = new URLSearchParams()
  if (type) params.set("type", type)
  const query = appendPagination(params, pagination).toString()
  return query ? `?${query}` : ""
}
