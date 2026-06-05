import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  learnEntriesResponseSchema,
  learnEntryResponseSchema,
  learnSummaryResponseSchema,
  topicResponseSchema,
  topicsResponseSchema,
  weakSpotsResponseSchema,
  type CreateLearnEntryInput,
  type CreateTopicInput,
  type LearnEntriesResponse,
  type LearnEntryResponse,
  type LearnSummaryResponse,
  type TopicResponse,
  type TopicsResponse,
  type WeakSpotsResponse,
} from "@/types/learn.types"

export const learnQueryKeys = {
  all: ["learn"] as const,
  topics: ["learn", "topics"] as const,
  entries: ["learn", "entries"] as const,
  weakSpots: ["learn", "weakspots"] as const,
  summary: ["learn", "summary"] as const,
}

export function useLearningTopics() {
  return useQuery({
    queryKey: learnQueryKeys.topics,
    queryFn: () =>
      apiFetch<TopicsResponse>("/api/v1/learn/topics", {
        schema: topicsResponseSchema,
      }),
  })
}

export function useLearnEntries() {
  return useQuery({
    queryKey: learnQueryKeys.entries,
    queryFn: () =>
      apiFetch<LearnEntriesResponse>("/api/v1/learn/entries", {
        schema: learnEntriesResponseSchema,
      }),
  })
}

export function useWeakSpots() {
  return useQuery({
    queryKey: learnQueryKeys.weakSpots,
    queryFn: () =>
      apiFetch<WeakSpotsResponse>("/api/v1/learn/weakspots", {
        schema: weakSpotsResponseSchema,
      }),
  })
}

export function useLearnSummary() {
  return useQuery({
    queryKey: learnQueryKeys.summary,
    queryFn: () =>
      apiFetch<LearnSummaryResponse>("/api/v1/learn/summary", {
        schema: learnSummaryResponseSchema,
      }),
  })
}

export function useCreateLearningTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTopicInput) =>
      apiFetch<TopicResponse>("/api/v1/learn/topics", {
        method: "POST",
        body: input,
        schema: topicResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: learnQueryKeys.all }),
  })
}

export function useCreateLearnEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLearnEntryInput) =>
      apiFetch<LearnEntryResponse>("/api/v1/learn/entries", {
        method: "POST",
        body: input,
        schema: learnEntryResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: learnQueryKeys.all }),
  })
}
