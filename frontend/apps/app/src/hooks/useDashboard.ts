import { useQuery } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api"
import {
  dashboardSummaryResponseSchema,
  type DashboardSummaryResponse,
} from "@/types/dashboard.types"

export const dashboardQueryKeys = {
  summary: ["dashboard", "summary"] as const,
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
