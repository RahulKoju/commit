import { useMemo, useState, type FormEvent } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { Check, Download, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react"

import {
  useCreateHabit,
  useCreateHabitCategory,
  useDeleteHabit,
  useDeleteHabitCategory,
  useHabitCategories,
  useHabits,
  useReorderHabits,
  useUpdateHabit,
  useUpdateHabitCategory,
} from "@/hooks/useHabits"
import type {
  CreateHabitInput,
  Habit,
  HabitComparisonOperator,
  HabitType,
} from "@/types/habit.types"
import { HabitIcon } from "./HabitIcon"

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const
const COMPARISON_OPTIONS: Array<{
  value: HabitComparisonOperator
  label: string
}> = [
  { value: "gte", label: "At least" },
  { value: "lte", label: "At most" },
  { value: "eq", label: "Exactly" },
  { value: "between", label: "Between" },
]

export function ManageHabitsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const habitsQuery = useHabits()
  const reorderHabits = useReorderHabits()
  const [tab, setTab] = useState("habits")
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [optimisticOrder, setOptimisticOrder] = useState<string[] | null>(null)

  const habits = useMemo(() => habitsQuery.data?.habits ?? [], [habitsQuery.data])

  const orderedHabits = useMemo(() => {
    if (!optimisticOrder) return habits
    const byId = new Map(habits.map((habit) => [habit.id, habit]))
    const result: Habit[] = []
    for (const id of optimisticOrder) {
      const habit = byId.get(id)
      if (habit) {
        result.push(habit)
        byId.delete(id)
      }
    }
    result.push(...byId.values())
    return result
  }, [habits, optimisticOrder])

  // Rows currently swapped for the inline edit / delete-confirm forms are not
  // draggable, so they are excluded from sortable registration.
  const sortableIds = orderedHabits
    .filter((habit) => habit.id !== editingId && habit.id !== deletingId)
    .map((habit) => habit.id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || reorderHabits.isPending) return
    const current = sortableIds
    const from = current.indexOf(String(active.id))
    const to = current.indexOf(String(over.id))
    if (from === -1 || to === -1) return

    const next = arrayMove(current, from, to)
    setOptimisticOrder(next)
    try {
      await reorderHabits.mutateAsync({ habit_ids: next })
    } catch (err) {
      setOptimisticOrder(null)
      const { toast } = await import("sonner")
      toast.error(err instanceof Error ? err.message : "Reorder failed")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage habits</DialogTitle>
          <DialogDescription>
            Create, edit, or delete habits and their categories. Check-ins
            happen in the table.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="habits">Habits</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          <TabsContent value="habits" className="space-y-4">
            {!creating && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCreating((v) => !v)}
                >
                  <Plus />
                  Add habit
                </Button>
              </div>
            )}

            {creating ? <HabitForm onDone={() => setCreating(false)} /> : null}

            <div className="max-h-80 space-y-2 overflow-y-auto">
              <p className="text-xs text-muted-foreground">
                Drag the handle to reorder habits. Order applies to the habits
                table.
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sortableIds}
                  strategy={verticalListSortingStrategy}
                >
                  {orderedHabits.map((habit) => {
                    if (editingId === habit.id) {
                      return (
                        <EditHabitRow
                          key={habit.id}
                          habit={habit}
                          onDone={() => setEditingId(null)}
                        />
                      )
                    }
                    if (deletingId === habit.id) {
                      return (
                        <div
                          key={habit.id}
                          className="flex items-center justify-between rounded-lg border p-3 text-sm"
                        >
                          <span>
                            Delete <strong>{habit.name}</strong> and all its
                            logs?
                          </span>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </Button>
                            <DeleteHabitButton
                              habitId={habit.id}
                              onDone={() => setDeletingId(null)}
                            />
                          </div>
                        </div>
                      )
                    }
                    return (
                      <SortableHabitRow
                        key={habit.id}
                        habit={habit}
                        dragDisabled={reorderHabits.isPending}
                        onEdit={() => setEditingId(habit.id)}
                        onAskDelete={() => setDeletingId(habit.id)}
                      />
                    )
                  })}
                </SortableContext>
              </DndContext>
            </div>
          </TabsContent>

          <TabsContent value="categories">
            <CategoryPanel />
          </TabsContent>
        </Tabs>

        <DialogFooter showCloseButton>
          <ExportCSVButton />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SortableHabitRow({
  habit,
  dragDisabled,
  onEdit,
  onAskDelete,
}: {
  habit: Habit
  dragDisabled: boolean
  onEdit: () => void
  onAskDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: habit.id, disabled: dragDisabled })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
        isDragging ? "relative z-10 bg-muted/50 shadow-sm" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          aria-label={`Reorder ${habit.name}`}
          {...attributes}
          {...listeners}
          disabled={dragDisabled}
          className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
        >
          <GripVertical />
        </button>
        <HabitIcon habit={habit} />
        <div className="min-w-0">
          <p className="truncate font-medium">{habit.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {habit.category_name} · {habit.type}
            {habit.frequency_type === "weekly"
              ? ` · ${habit.frequency_days.length} day(s)/week`
              : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          title="Edit"
        >
          <Pencil />
        </button>
        <button
          type="button"
          onClick={onAskDelete}
          className="rounded p-1 text-muted-foreground hover:text-destructive"
          title="Delete"
        >
          <Trash2 />
        </button>
      </div>
    </div>
  )
}

function DeleteHabitButton({
  habitId,
  onDone,
}: {
  habitId: string
  onDone: () => void
}) {
  const deleteHabit = useDeleteHabit()
  async function handleDelete() {
    await deleteHabit.mutateAsync(habitId)
    onDone()
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      onClick={handleDelete}
      disabled={deleteHabit.isPending}
    >
      {deleteHabit.isPending ? "Deleting..." : "Delete"}
    </Button>
  )
}

function ExportCSVButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:8080"}/api/v1/habits/export`,
        {
          credentials: "include",
        }
      )
      if (!resp.ok) {
        const body = await resp.json().catch(() => null)
        throw new Error(body?.error ?? "Export failed")
      }
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "habits.csv"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      const { toast } = await import("sonner")
      toast.error(err instanceof Error ? err.message : "Export failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={loading}
    >
      <Download />
      {loading ? "Exporting..." : "Export CSV"}
    </Button>
  )
}

function EditHabitRow({ habit, onDone }: { habit: Habit; onDone: () => void }) {
  const updateHabit = useUpdateHabit()
  const categoriesQuery = useHabitCategories()
  const [name, setName] = useState(habit.name)
  const [icon, setIcon] = useState(habit.icon ?? "")
  const [description, setDescription] = useState(habit.description)
  const [categoryId, setCategoryId] = useState(habit.category_id)
  const [type, setType] = useState<HabitType>(habit.type)
  const [targetValue, setTargetValue] = useState(habit.target_value ?? 0)
  const [targetValueMax, setTargetValueMax] = useState(
    habit.target_value_max ?? (habit.target_value ?? 0) + 1
  )
  const [comparisonOperator, setComparisonOperator] =
    useState<HabitComparisonOperator>(habit.comparison_operator)
  const [targetUnit, setTargetUnit] = useState(habit.target_unit ?? "")
  const [frequencyType, setFrequencyType] = useState(habit.frequency_type)
  const [frequencyDays, setFrequencyDays] = useState<number[]>(
    habit.frequency_days
  )
  const [weeklyGoal, setWeeklyGoal] = useState(habit.weekly_goal)
  const [error, setError] = useState<string | null>(null)

  function toggleDay(day: number) {
    setFrequencyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await updateHabit.mutateAsync({
        habitId: habit.id,
        input: {
          name: name !== habit.name ? name : undefined,
          icon: icon !== (habit.icon ?? "") ? icon : undefined,
          description:
            description !== habit.description ? description : undefined,
          category_id:
            categoryId !== habit.category_id ? categoryId : undefined,
          type: type !== habit.type ? type : undefined,
          target_value:
            type === "numeric" && targetValue !== (habit.target_value ?? 0)
              ? targetValue
              : undefined,
          target_value_max:
            type === "numeric" && comparisonOperator === "between"
              ? targetValueMax
              : undefined,
          comparison_operator:
            type === "numeric" &&
            comparisonOperator !== habit.comparison_operator
              ? comparisonOperator
              : undefined,
          target_unit:
            type === "numeric" && targetUnit !== (habit.target_unit ?? "")
              ? targetUnit
              : undefined,
          frequency_type:
            frequencyType !== habit.frequency_type ? frequencyType : undefined,
          frequency_days:
            JSON.stringify(frequencyDays) !==
            JSON.stringify(habit.frequency_days)
              ? frequencyDays
              : undefined,
          weekly_goal:
            weeklyGoal !== habit.weekly_goal ? weeklyGoal : undefined,
        },
      })
      onDone()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update habit"
      )
    }
  }

  return (
    <form className="grid gap-3 rounded-lg border p-3" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor={`edit-name-${habit.id}`}>Name</Label>
        <Input
          id={`edit-name-${habit.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`edit-icon-${habit.id}`}>Icon (optional)</Label>
        <Input
          id={`edit-icon-${habit.id}`}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          maxLength={8}
          placeholder="e.g. 🏃"
          title="A single emoji shown as the habit's compact label in the matrix"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`edit-desc-${habit.id}`}>Description</Label>
        <textarea
          id={`edit-desc-${habit.id}`}
          rows={1}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`edit-category-${habit.id}`}>Category</Label>
        <CategoryCombobox
          id={`edit-category-${habit.id}`}
          categories={categoriesQuery.data?.categories ?? []}
          value={categoryId}
          onChange={setCategoryId}
        />
      </div>

      <div
        className={
          type === "numeric" ? "grid gap-2 sm:grid-cols-3" : "grid gap-2"
        }
      >
        <div className="grid gap-2">
          <Label htmlFor={`edit-type-${habit.id}`}>Type</Label>
          <select
            id={`edit-type-${habit.id}`}
            value={type}
            onChange={(e) => setType(e.target.value as HabitType)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="boolean">Boolean</option>
            <option value="numeric">Numeric</option>
          </select>
        </div>
        {type === "numeric" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor={`edit-operator-${habit.id}`}>Goal</Label>
              <select
                id={`edit-operator-${habit.id}`}
                value={comparisonOperator}
                onChange={(e) =>
                  setComparisonOperator(
                    e.target.value as HabitComparisonOperator
                  )
                }
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                {COMPARISON_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`edit-target-${habit.id}`}>
                {comparisonOperator === "between" ? "Minimum" : "Target value"}
              </Label>
              <Input
                id={`edit-target-${habit.id}`}
                type="number"
                min={0}
                step="0.1"
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
              />
            </div>
            {comparisonOperator === "between" ? (
              <div className="grid gap-2">
                <Label htmlFor={`edit-target-max-${habit.id}`}>Maximum</Label>
                <Input
                  id={`edit-target-max-${habit.id}`}
                  type="number"
                  min={0}
                  step="0.1"
                  value={targetValueMax}
                  onChange={(e) => setTargetValueMax(Number(e.target.value))}
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor={`edit-unit-${habit.id}`}>Unit</Label>
              <Input
                id={`edit-unit-${habit.id}`}
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`edit-freq-${habit.id}`}>Frequency</Label>
          <select
            id={`edit-freq-${habit.id}`}
            value={frequencyType}
            onChange={(e) =>
              setFrequencyType(e.target.value as "daily" | "weekly")
            }
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Specific days</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`edit-goal-${habit.id}`}>Weekly goal</Label>
          <Input
            id={`edit-goal-${habit.id}`}
            type="number"
            min={1}
            value={weeklyGoal}
            onChange={(e) => setWeeklyGoal(Number(e.target.value))}
          />
        </div>
      </div>

      {frequencyType === "weekly" ? (
        <div className="grid gap-2">
          <Label>Days of week</Label>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, i) => {
              const day = i + 1
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                    frequencyDays.includes(day)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={updateHabit.isPending}>
          {updateHabit.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

function HabitForm({ onDone }: { onDone: () => void }) {
  const [categoryId, setCategoryId] = useState("")
  const [type, setType] = useState<HabitType>("boolean")
  const [comparisonOperator, setComparisonOperator] =
    useState<HabitComparisonOperator>("gte")
  const [frequencyType, setFrequencyType] = useState("daily")
  const [frequencyDays, setFrequencyDays] = useState<number[]>([
    1, 2, 3, 4, 5, 6, 7,
  ])
  const [error, setError] = useState<string | null>(null)
  const createHabit = useCreateHabit()
  const categoriesQuery = useHabitCategories()

  function toggleDay(day: number) {
    setFrequencyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set("category_id", categoryId)
    formData.set("type", type)
    formData.set("comparison_operator", comparisonOperator)
    formData.set("frequency_days", JSON.stringify(frequencyDays))
    try {
      await createHabit.mutateAsync(habitInputFromFormData(formData))
      form.reset()
      setCategoryId("")
      setType("boolean")
      setComparisonOperator("gte")
      setFrequencyType("daily")
      setFrequencyDays([1, 2, 3, 4, 5, 6, 7])
      onDone()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create habit"
      )
    }
  }

  return (
    <form className="grid gap-3 rounded-lg border p-3" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="new-habit-name">Name</Label>
        <input
          id="new-habit-name"
          name="name"
          required
          placeholder="Meditate"
          className="h-9 rounded-md border bg-background px-3 text-sm"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="new-habit-icon">Icon (optional)</Label>
        <input
          id="new-habit-icon"
          name="icon"
          maxLength={8}
          placeholder="e.g. 🧘"
          title="A single emoji shown as the habit's compact label in the matrix"
          className="h-9 rounded-md border bg-background px-3 text-sm"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="new-habit-category">Category</Label>
        <CategoryCombobox
          id="new-habit-category"
          categories={categoriesQuery.data?.categories ?? []}
          value={categoryId}
          onChange={setCategoryId}
        />
      </div>

      <div
        className={
          type === "numeric" ? "grid gap-2 sm:grid-cols-3" : "grid gap-2"
        }
      >
        <div className="grid gap-2">
          <Label htmlFor="new-habit-type">Type</Label>
          <select
            id="new-habit-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as HabitType)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="boolean">Boolean</option>
            <option value="numeric">Numeric</option>
          </select>
        </div>
        {type === "numeric" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="new-habit-operator">Goal</Label>
              <select
                id="new-habit-operator"
                name="comparison_operator"
                value={comparisonOperator}
                onChange={(e) =>
                  setComparisonOperator(
                    e.target.value as HabitComparisonOperator
                  )
                }
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                {COMPARISON_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-habit-target">
                {comparisonOperator === "between" ? "Minimum" : "Target value"}
              </Label>
              <input
                id="new-habit-target"
                name="target_value"
                type="number"
                min={0}
                step="0.1"
                placeholder={
                  comparisonOperator === "between" ? "Min" : "Target"
                }
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            {comparisonOperator === "between" ? (
              <div className="grid gap-2">
                <Label htmlFor="new-habit-target-max">Maximum</Label>
                <input
                  id="new-habit-target-max"
                  name="target_value_max"
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="Max"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="new-habit-unit">Unit</Label>
              <input
                id="new-habit-unit"
                name="target_unit"
                placeholder="Unit"
                className="h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="new-habit-freq">Frequency</Label>
          <select
            id="new-habit-freq"
            name="frequency_type"
            value={frequencyType}
            onChange={(e) => setFrequencyType(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Specific days</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-habit-goal">Weekly goal</Label>
          <input
            id="new-habit-goal"
            name="weekly_goal"
            type="number"
            min={1}
            defaultValue={7}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
      </div>

      {frequencyType === "weekly" ? (
        <div className="grid gap-2">
          <Label>Days of week</Label>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, i) => {
              const day = i + 1
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                    frequencyDays.includes(day)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="new-habit-desc">Description</Label>
        <textarea
          id="new-habit-desc"
          name="description"
          rows={1}
          placeholder="Description"
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={createHabit.isPending}>
          {createHabit.isPending ? "Creating..." : "Create habit"}
        </Button>
      </div>
    </form>
  )
}

function CategoryPanel() {
  const categoriesQuery = useHabitCategories()
  const createCategory = useCreateHabitCategory()
  const updateCategory = useUpdateHabitCategory()
  const deleteCategory = useDeleteHabitCategory()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError(null)
    try {
      await createCategory.mutateAsync({
        name: String(formData.get("name") ?? ""),
      })
      event.currentTarget.reset()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create category"
      )
    }
  }

  async function onUpdate(id: string) {
    if (!editName.trim()) return
    setError(null)
    try {
      await updateCategory.mutateAsync({
        categoryId: id,
        input: { name: editName.trim() },
      })
      setEditingId(null)
      setEditName("")
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update category"
      )
    }
  }

  async function onDelete(id: string) {
    setError(null)
    try {
      await deleteCategory.mutateAsync(id)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to delete category"
      )
    }
  }

  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={onCreate}>
        <Label htmlFor="category-name" className="sr-only">
          Category name
        </Label>
        <input
          id="category-name"
          name="name"
          required
          placeholder="New category name"
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit" size="sm" disabled={createCategory.isPending}>
          <Plus />
          Add
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {categoriesQuery.data?.categories.length ? (
        <div className="space-y-1">
          {categoriesQuery.data.categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50"
            >
              {editingId === cat.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 min-w-0 flex-1 rounded border bg-background px-2 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onUpdate(cat.id)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => onUpdate(cat.id)}
                    className="rounded p-1 text-green-600 hover:bg-green-100"
                  >
                    <Check />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate">{cat.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(cat.id)
                      setEditName(cat.name)
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(cat.id)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CategoryCombobox({
  id,
  categories,
  value,
  onChange,
}: {
  id: string
  categories: Array<{ id: string; name: string }>
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )
  const selected = categories.find((c) => c.id === value)

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 text-left text-sm"
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected?.name ?? "Select category"}
        </span>
        <span className="text-muted-foreground">▾</span>
      </button>
      {open ? (
        <div
          className="absolute z-30 mt-1 w-full rounded-xl border bg-background shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No categories found
              </li>
            ) : (
              filtered.map((category) => (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(category.id)
                      setOpen(false)
                      setSearch("")
                    }}
                    className={`w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-muted ${
                      category.id === value ? "bg-muted font-medium" : ""
                    }`}
                  >
                    {category.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function habitInputFromFormData(formData: FormData): CreateHabitInput {
  const habitType = String(formData.get("type") ?? "boolean") as HabitType
  const targetValue = optionalNumber(formData.get("target_value"))
  const targetValueMax = optionalNumber(formData.get("target_value_max"))
  const comparisonOperator = String(
    formData.get("comparison_operator") ?? "gte"
  ) as HabitComparisonOperator
  const freqDaysRaw = formData.get("frequency_days")
  const frequencyDays: number[] = freqDaysRaw
    ? JSON.parse(String(freqDaysRaw))
    : [1, 2, 3, 4, 5, 6, 7]
  return {
    category_id: String(formData.get("category_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    icon: String(formData.get("icon") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? ""),
    type: habitType,
    target_value: habitType === "numeric" ? targetValue : undefined,
    target_value_max:
      habitType === "numeric" && comparisonOperator === "between"
        ? targetValueMax
        : undefined,
    comparison_operator:
      habitType === "numeric" ? comparisonOperator : undefined,
    target_unit:
      habitType === "numeric" ? String(formData.get("target_unit") ?? "") : "",
    frequency_type:
      String(formData.get("frequency_type") ?? "daily") === "weekly"
        ? "weekly"
        : "daily",
    frequency_days: frequencyDays,
    weekly_goal: Number(formData.get("weekly_goal") ?? 7),
    sort_order: 0,
  }
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  if (value === null) return undefined
  const text = String(value).trim()
  if (text === "") return undefined
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : undefined
}
