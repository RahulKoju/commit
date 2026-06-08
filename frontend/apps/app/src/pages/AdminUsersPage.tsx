import { Shield, Trash2 } from "lucide-react"
import { useState } from "react"
import { Navigate } from "react-router-dom"

import { Button } from "@workspace/ui/components/button"

import { useCurrentUser } from "@/hooks/useAuth"
import { useAdminUsers, useDeleteUser } from "@/hooks/useAdmin"
import type { User } from "@/types/auth.types"

export function AdminUsersPage() {
  const currentUser = useCurrentUser()
  const usersQuery = useAdminUsers()
  const deleteUser = useDeleteUser()
  const [confirmUser, setConfirmUser] = useState<User | null>(null)

  if (currentUser.isLoading) return null
  if (currentUser.data?.user.role !== "admin") return <Navigate replace to="/dashboard" />

  const users = usersQuery.data?.users ?? []

  async function handleDelete() {
    if (!confirmUser) return
    await deleteUser.mutateAsync(confirmUser.id)
    setConfirmUser(null)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Shield className="size-6 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      </div>

      <div className="rounded-xl border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {user.role !== "admin" ? (
                      <button
                        type="button"
                        onClick={() => setConfirmUser(user)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${user.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmUser(null)}>
          <div className="w-[90vw] max-w-md rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Delete user</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{confirmUser.name}</strong>? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setConfirmUser(null)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteUser.isPending}>
                {deleteUser.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
