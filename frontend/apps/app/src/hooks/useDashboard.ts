import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  dashboardHeatmapResponseSchema,
  dashboardLayoutResponseSchema,
  dashboardSummaryResponseSchema,
  type DashboardHeatmapResponse,
  type DashboardLayoutResponse,
  type DashboardSummaryResponse,
} from "@/types/dashboard.types"

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  summary: ["dashboard", "summary"] as const,
  activityHeatmap: ["dashboard", "activity-heatmap"] as const,
  layout: ["dashboard", "layout"] as const,
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

export function useActivityHeatmap(year?: number) {
  return useQuery({
    queryKey: [...dashboardQueryKeys.activityHeatmap, year ?? null],
    queryFn: () =>
      apiFetch<DashboardHeatmapResponse>(
        year ? `/api/v1/dashboard/activity-heatmap?year=${year}` : "/api/v1/dashboard/activity-heatmap",
        {
          schema: dashboardHeatmapResponseSchema,
        },
      ),
  })
}

export function useDashboardLayout() {
  return useQuery({
    queryKey: dashboardQueryKeys.layout,
    queryFn: () =>
      apiFetch<DashboardLayoutResponse>("/api/v1/dashboard/layout", {
        schema: dashboardLayoutResponseSchema,
      }),
  })
}

export function useSaveDashboardLayout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (layout: string[]) =>
      apiFetch<DashboardLayoutResponse>("/api/v1/dashboard/layout", {
        method: "PATCH",
        body: { layout },
        schema: dashboardLayoutResponseSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.layout }),
  })
}