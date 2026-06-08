import { z } from "zod"
import { userSchema } from "./auth.types"

export const adminUsersResponseSchema = z.object({
  users: z.array(userSchema),
})

export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>
