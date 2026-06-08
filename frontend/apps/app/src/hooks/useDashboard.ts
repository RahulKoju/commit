import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  activityHeatmapResponseSchema,
  dashboardSummaryResponseSchema,
  type ActivityHeatmapResponse,
  type DashboardSummaryResponse,
} from "@/types/dashboard.types"

export const dashboardQueryKeys = {
  summary: ["dashboard", "summary"] as const,
  activityHeatmap: ["dashboard", "activity-heatmap"] as const,
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardQueryKeys.summary,
    queryFn: () =>
      apiFetch<DashboardSummaryResponse>("/api/v1/dashboard/summary", {
        schema: dashboardSummaryResponseSchema,
      }),
  })
}

export function useActivityHeatmap() {
  return useQuery({
    queryKey: dashboardQueryKeys.activityHeatmap,
    queryFn: () =>
      apiFetch<ActivityHeatmapResponse>("/api/v1/dashboard/activity-heatmap", {
        schema: activityHeatmapResponseSchema,
      }),
  })
}