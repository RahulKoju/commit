import axios, { type AxiosError, type AxiosRequestConfig } from "axios"
import { z } from "zod"

type RequestOptions<T> = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  headers?: Record<string, string>
  schema?: z.ZodType<T>
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
  withCredentials: true,
})

export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions<T> = {}
): Promise<T> {
  const config: AxiosRequestConfig = {
    url: endpoint,
    method: options.method ?? "GET",
    headers: options.headers,
    data: options.body,
  }

  if (import.meta.env.DEV) {
    console.info("[api]", config.method, endpoint)
  }

  try {
    const response = await api.request<unknown>(config)
    if (options.schema) {
      return options.schema.parse(response.data)
    }
    return response.data as T
  } catch (error) {
    const axiosError = error as AxiosError<unknown>
    if (axiosError.response?.status === 401 && window.location.pathname !== "/login") {
      window.location.assign("/login")
    }
    throw parseApiError(axiosError)
  }
}

function parseApiError(error: AxiosError<unknown>): Error {
  const status = error.response?.status
  const data = error.response?.data
  if (isErrorPayload(data)) {
    const err = new Error(data.error) as Error & { status?: number }
    err.status = status
    return err
  }
  const err = new Error(error.message || "API request failed") as Error & { status?: number }
  err.status = status
  return err
}

function isErrorPayload(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  )
}
