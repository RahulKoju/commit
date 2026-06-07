import DOMPurify from "dompurify"
import { Plus, Trash2 } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"
import { RichTextEditor } from "@workspace/ui/components/rich-text-editor"

import {
  useCreateTask,
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from "@/hooks/useTasks"
import type {
  CreateTaskInput,
  Task,
  TaskPriority,
  TaskStatus,
  TaskView,
} from "@/types/task.types"

const views: Array<{ value: TaskView; label: string }> = [
  { value: "today", label: "Today" },
  { value: "backlog", label: "Backlog" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All Tasks" },
]

const priorities: Array<{ value: TaskPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

const statuses: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
]

export function TasksPage() {
  const [view, setView] = useState<TaskView>("today")
  const [priority, setPriority] = useState<TaskPriority | "">("")
  const [status, setStatus] = useState<TaskStatus | "">("")
  const filters = useMemo(() => ({ view, priority, status }), [view, priority, status])
  const tasksQuery = useTasks(filters)

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Plan today, keep backlog clean, and review completed work.
          </p>
        </div>
        <CreateTaskPanel />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {views.map((item) => (
          <Button
            key={item.value}
            type="button"
            variant={view === item.value ? "default" : "outline"}
            onClick={() => setView(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border bg-background p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Priority</span>
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={priority}
            onChange={(event) => setPriority(event.target.value as TaskPriority | "")}
          >
            <option value="">Any</option>
            {priorities.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus | "")}
          >
            <option value="">Any</option>
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tasksQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading tasks...</p>
      ) : null}
      {tasksQuery.isError ? (
        <p className="text-sm text-destructive">Unable to load tasks.</p>
      ) : null}
      {tasksQuery.data ? <TaskList tasks={tasksQuery.data.data} /> : null}
    </section>
  )
}

function CreateTaskPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button type="button" onClick={() => setOpen((value) => !value)}>
        <Plus className="size-4" />
        New task
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-[min(92vw,32rem)] rounded-xl border bg-background p-4 shadow-xl">
          <TaskForm onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  )
}

export function TaskForm({ onDone }: { onDone: () => void }) {
  const createTask = useCreateTask()
  const [resetToken, setResetToken] = useState("initial")
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const formData = new FormData(form)
    const taskInput = taskInputFromFormData(formData)

    try {
      await createTask.mutateAsync(taskInput)
      form.reset()
      setResetToken(String(Date.now()))
      onDone()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create task")
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          name="title"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Priority</span>
          <select name="priority" defaultValue="medium" className="h-9 rounded-md border bg-background px-3">
            {priorities.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Status</span>
          <select name="status" defaultValue="todo" className="h-9 rounded-md border bg-background px-3">
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Due date</span>
          <input name="scheduled_date" type="date" className="h-9 rounded-md border bg-background px-3" />
        </label>
      </div>
      <RichTextEditor
        id="task-description"
        name="description"
        placeholder="Add task context, links, and notes."
        maxLength={2000}
        resetToken={resetToken}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={createTask.isPending}>
          {createTask.isPending ? "Creating..." : "Create task"}
        </Button>
      </div>
    </form>
  )
}

function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
        No tasks match this view.
      </div>
    )
  }

  return (
    <div className="grid gap-3">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} />
      ))}
    </div>
  )
}

function TaskCard({ task }: { task: Task }) {
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  async function updateStatus(status: TaskStatus) {
    await updateTask.mutateAsync({ id: task.id, input: { status } })
  }

  async function deleteCurrentTask() {
    await deleteTask.mutateAsync(task.id)
  }

  return (
    <article className="rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{task.title}</h2>
            <span className="rounded-full border px-2 py-0.5 text-xs capitalize">
              {task.priority}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-xs">
              {statusLabel(task.status)}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{task.scheduled_date ? `Due ${task.scheduled_date}` : "No due date"}</span>
            {task.completed_at ? <span>Completed {new Date(task.completed_at).toLocaleDateString()}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {task.status !== "todo" ? (
            <Button type="button" variant="outline" size="sm" onClick={() => updateStatus("todo")}>
              Todo
            </Button>
          ) : null}
          {task.status !== "in-progress" ? (
            <Button type="button" variant="outline" size="sm" onClick={() => updateStatus("in-progress")}>
              Start
            </Button>
          ) : null}
          {task.status !== "done" ? (
            <Button type="button" size="sm" onClick={() => updateStatus("done")}>
              Complete
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="icon" aria-label="Delete task" onClick={deleteCurrentTask}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {task.description ? (
        <div
          className="prose prose-sm mt-3 max-w-none text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(task.description) }}
        />
      ) : null}
    </article>
  )
}

function taskInputFromFormData(formData: FormData): CreateTaskInput {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    priority: String(formData.get("priority") ?? "medium") as TaskPriority,
    scheduled_date: String(formData.get("scheduled_date") ?? ""),
    status: String(formData.get("status") ?? "todo") as TaskStatus,
  }
}

function statusLabel(status: TaskStatus): string {
  if (status === "in-progress") {
    return "In progress"
  }
  return status.charAt(0).toUpperCase() + status.slice(1)
}
