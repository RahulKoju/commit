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

let isRefreshing = false
let isRedirecting = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}> = []

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error)
    } else {
      resolve(undefined)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/auth/refresh")) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => api(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await api.post("/api/v1/auth/refresh")
        processQueue(null)
        return api(originalRequest)
      } catch {
        processQueue(error)
        if (!isRedirecting) {
          isRedirecting = true
          const { toast } = await import("sonner")
          toast.error("Your session has expired. Please log in again.")
          const webUrl = import.meta.env.VITE_WEB_URL ?? "http://localhost:5173"
          setTimeout(() => {
            window.location.assign(`${webUrl}/login`)
          }, 500)
        }
        return Promise.reject(error)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

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
    throw parseApiError(error as AxiosError<unknown>)
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
