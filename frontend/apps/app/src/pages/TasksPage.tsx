import DOMPurify from "dompurify"
import { AlertTriangle, CalendarPlus, Clock, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react"
import { useMemo, useRef, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
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
  RecurrenceRule,
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

const recurrenceLabels: Record<RecurrenceRule, string> = {
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
  monthly: "Monthly",
}

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
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Repeat</span>
          <select name="recurrence_rule" className="h-9 rounded-md border bg-background px-3">
            <option value="">Never</option>
            {Object.entries(recurrenceLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-medium">Est. time (min)</span>
          <input name="estimated_minutes" type="number" min={1} className="h-9 rounded-md border bg-background px-3" />
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
  const navigate = useNavigate()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [editingField, setEditingField] = useState<"title" | "description" | null>(null)
  const [editValue, setEditValue] = useState("")
  const titleInputRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().slice(0, 10)
  const isNotToday = task.scheduled_date !== today

  async function updateStatus(status: TaskStatus) {
    await updateTask.mutateAsync({ id: task.id, input: { status } })
  }

  async function moveToToday() {
    await updateTask.mutateAsync({ id: task.id, input: { scheduled_date: today } })
  }

  async function deleteCurrentTask() {
    await deleteTask.mutateAsync(task.id)
  }

  function startEdit(field: "title" | "description") {
    setEditValue(field === "title" ? task.title : DOMPurify.sanitize(task.description, { ALLOWED_TAGS: [] }))
    setEditingField(field)
  }

  async function saveEdit() {
    const field = editingField
    setEditingField(null)
    const trimmed = editValue.trim()
    if (!trimmed) return
    if (field === "title") {
      await updateTask.mutateAsync({ id: task.id, input: { title: trimmed } })
    } else {
      await updateTask.mutateAsync({ id: task.id, input: { description: trimmed } })
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && editingField === "title") {
      event.preventDefault()
      saveEdit()
    }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && editingField === "description") {
      event.preventDefault()
      saveEdit()
    }
    if (event.key === "Escape") {
      setEditingField(null)
    }
  }

  const statusColors: Record<TaskStatus, string> = {
    "todo": "bg-muted text-muted-foreground border-muted-foreground/30",
    "in-progress": "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400",
    "done": "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400",
  }

  const priorityColors: Record<TaskPriority, string> = {
    "high": "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400",
    "medium": "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400",
    "low": "bg-muted text-muted-foreground border-muted-foreground/30",
  }

  const priorityBorders: Record<TaskPriority, string> = {
    "high": "border-l-red-500 dark:border-l-red-400",
    "medium": "border-l-amber-500 dark:border-l-amber-400",
    "low": "border-l-muted-foreground/30",
  }

  return (
    <article className={`group rounded-xl border bg-background p-4 border-l-4 ${priorityBorders[task.priority]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {editingField === "title" ? (
              <input
                ref={titleInputRef}
                className="h-8 rounded-md border bg-background px-2 text-sm font-semibold"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={saveEdit}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            ) : (
              <h2
                className="group/title flex items-center gap-1.5 font-semibold"
                onClick={() => startEdit("title")}
              >
                {task.title}
                <Pencil className="size-3.5 opacity-0 transition-opacity group-hover/title:opacity-100 text-muted-foreground" />
              </h2>
            )}
            <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${statusColors[task.status]}`}>
              {statusLabel(task.status)}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {task.scheduled_date ? (
              <span className="flex items-center gap-1">
                {task.status !== "done" && task.scheduled_date < today ? (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="size-3" />
                    Overdue {task.scheduled_date}
                  </span>
                ) : (
                  <>Due {task.scheduled_date}</>
                )}
              </span>
            ) : (
              <span>No due date</span>
            )}
            {task.recurrence_rule ? (
              <span className="flex items-center gap-1">
                <Repeat className="size-3" />
                {recurrenceLabels[task.recurrence_rule as RecurrenceRule] ?? task.recurrence_rule}
              </span>
            ) : null}
            {task.estimated_minutes ? (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                ~{task.estimated_minutes} min
              </span>
            ) : null}
            {task.completed_at ? <span>Completed {new Date(task.completed_at).toLocaleDateString()}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isNotToday && task.status !== "done" ? (
            <Button type="button" variant="outline" size="sm" onClick={moveToToday}>
              <CalendarPlus className="size-3.5" />
              Today
            </Button>
          ) : null}
          {task.status !== "done" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/focus", { state: { taskId: task.id, taskTitle: task.title } })}
            >
              <Play className="size-3.5" />
              Focus
            </Button>
          ) : null}
          <div className="flex overflow-hidden rounded-lg border">
            {(["todo", "in-progress", "done"] as const).map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={task.status === status ? "default" : "ghost"}
                className={`rounded-none border-0 ${task.status === status ? "" : "text-muted-foreground"}`}
                onClick={() => updateStatus(status)}
              >
                {statusLabel(status)}
              </Button>
            ))}
          </div>
          <Button type="button" variant="outline" size="icon" aria-label="Delete task" onClick={deleteCurrentTask}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {editingField === "description" ? (
        <div className="mt-3 space-y-2">
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={3}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setEditingField(null)}>Cancel</Button>
            <Button type="button" size="sm" onClick={saveEdit}>Save</Button>
          </div>
        </div>
      ) : task.description ? (
        <div className="group/desc relative">
          <div
            className="prose prose-sm mt-3 max-w-none text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(task.description) }}
          />
          <button
            type="button"
            className="absolute right-0 top-0 opacity-0 transition-opacity group-hover/desc:opacity-100 text-muted-foreground hover:text-foreground"
            onClick={() => startEdit("description")}
          >
            <Pencil className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          onClick={() => startEdit("description")}
        >
          <Pencil className="size-3" />
          Add description
        </button>
      )}
    </article>
  )
}

function taskInputFromFormData(formData: FormData): CreateTaskInput {
  const estimatedRaw = formData.get("estimated_minutes")
  const estimatedMinutes = estimatedRaw ? Number(estimatedRaw) : null
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    priority: String(formData.get("priority") ?? "medium") as TaskPriority,
    scheduled_date: String(formData.get("scheduled_date") ?? ""),
    status: String(formData.get("status") ?? "todo") as TaskStatus,
    recurrence_rule: String(formData.get("recurrence_rule") ?? ""),
    estimated_minutes: estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : null,
  }
}

function statusLabel(status: TaskStatus): string {
  if (status === "in-progress") {
    return "In progress"
  }
  return status.charAt(0).toUpperCase() + status.slice(1)
}
