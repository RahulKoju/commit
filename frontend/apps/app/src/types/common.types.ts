import { z } from "zod"

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  })
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  limit: number
  offset: number
}

export type PaginationParams = {
  limit?: number
  offset?: number
}

export function appendPagination(params: URLSearchParams, pagination?: PaginationParams): URLSearchParams {
  if (pagination?.limit != null) params.set("limit", String(pagination.limit))
  if (pagination?.offset != null) params.set("offset", String(pagination.offset))
  return params
}
