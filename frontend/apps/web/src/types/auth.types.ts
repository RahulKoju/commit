import { z } from "zod"

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["user", "admin"]),
  created_at: z.string(),
  updated_at: z.string(),
})

export const authResponseSchema = z.object({
  user: userSchema,
})

export const forgotPasswordResponseSchema = z.object({
  message: z.string(),
})

export const resetPasswordResponseSchema = z.object({
  message: z.string(),
})

export type User = z.infer<typeof userSchema>
export type AuthResponse = z.infer<typeof authResponseSchema>
export type ForgotPasswordResponse = z.infer<typeof forgotPasswordResponseSchema>
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>
