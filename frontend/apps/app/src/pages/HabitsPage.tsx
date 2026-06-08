import { BarChart3, Plus, Trash2, Pencil, X, Search } from "lucide-react"
import { useMemo, useState, useEffect, useRef, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import {
  useCreateHabit,
  useCreateHabitCategory,
  useDeleteHabit,
  useHabitAnalytics,
  useHabitCategories,
  useHabits,
  useLogHabit,
  useUpdateHabit,
} from "@/hooks/useHabits"
import type { CreateHabitInput, Habit, HabitType } from "@/types/habit.types"

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

export function HabitsPage() {
  const habitsQuery = useHabits()
  const categoriesQuery = useHabitCategories()
  const [selectedHabitId, setSelectedHabitId] = useState("")
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null)
  const groupedHabits = useMemo(() => groupHabits(habitsQuery.data?.habits ?? []), [habitsQuery.data?.habits])
  const selectedHabit = habitsQuery.data?.habits.find((habit) => habit.id === selectedHabitId) ?? habitsQuery.data?.habits[0]

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Habits</h1>
          <p className="text-sm text-muted-foreground">
            Check in daily, track numeric targets, and review streaks.
          </p>
        </div>
        <div className="flex gap-2">
          <CategoryForm />
          <HabitForm categories={categoriesQuery.data?.categories ?? []} />
        </div>
      </div>

      {habitsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading habits...</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {groupedHabits.map((group) => (
            <div key={group.categoryName} className="rounded-xl border bg-background p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">{group.categoryName}</h2>
                <span className="text-sm text-muted-foreground">
                  {group.habits.filter(isCompletedToday).length}/{group.habits.length}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.habits.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    selected={selectedHabit?.id === habit.id}
                    onSelect={() => setSelectedHabitId(habit.id)}
                    onEdit={() => setEditingHabit(habit)}
                    onDelete={() => setDeletingHabit(habit)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-6">
          <DailyRing habits={habitsQuery.data?.habits ?? []} />
          {selectedHabit ? <HabitAnalyticsPanel habit={selectedHabit} /> : null}
        </aside>
      </div>

      {editingHabit ? (
        <EditHabitModal
          habit={editingHabit}
          categories={categoriesQuery.data?.categories ?? []}
          onClose={() => setEditingHabit(null)}
        />
      ) : null}

      {deletingHabit ? (
        <DeleteHabitModal
          habit={deletingHabit}
          onClose={() => setDeletingHabit(null)}
        />
      ) : null}
    </section>
  )
}

/* ─── Delete confirmation modal ─── */
function DeleteHabitModal({ habit, onClose }: { habit: Habit; onClose: () => void }) {
  const deleteHabit = useDeleteHabit()

  async function handleDelete() {
    await deleteHabit.mutateAsync(habit.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[90vw] max-w-md rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Delete habit</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This will permanently remove <strong>{habit.name}</strong> and all its logs. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteHabit.isPending}>
            {deleteHabit.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Edit habit modal ─── */
function EditHabitModal({
  habit,
  categories,
  onClose,
}: {
  habit: Habit
  categories: Array<{ id: string; name: string }>
  onClose: () => void
}) {
  const updateHabit = useUpdateHabit()
  const [name, setName] = useState(habit.name)
  const [description, setDescription] = useState(habit.description)
  const [categoryId, setCategoryId] = useState(habit.category_id)
  const [type, setType] = useState<HabitType>(habit.type)
  const [targetValue, setTargetValue] = useState(habit.target_value ?? 0)
  const [targetUnit, setTargetUnit] = useState(habit.target_unit ?? "")
  const [frequencyType, setFrequencyType] = useState(habit.frequency_type)
  const [frequencyDays, setFrequencyDays] = useState<number[]>(habit.frequency_days)
  const [weeklyGoal, setWeeklyGoal] = useState(habit.weekly_goal)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await updateHabit.mutateAsync({
      habitId: habit.id,
      input: {
        name: name !== habit.name ? name : undefined,
        description: description !== habit.description ? description : undefined,
        category_id: categoryId !== habit.category_id ? categoryId : undefined,
        type: type !== habit.type ? type : undefined,
        target_value: targetValue !== (habit.target_value ?? 0) ? targetValue : undefined,
        target_unit: targetUnit !== (habit.target_unit ?? "") ? targetUnit : undefined,
        frequency_type: frequencyType !== habit.frequency_type ? frequencyType : undefined,
        frequency_days: JSON.stringify(frequencyDays) !== JSON.stringify(habit.frequency_days) ? frequencyDays : undefined,
        weekly_goal: weeklyGoal !== habit.weekly_goal ? weeklyGoal : undefined,
      },
    })
    onClose()
  }

  function toggleDay(day: number) {
    setFrequencyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[90vw] max-w-lg rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit habit</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <textarea
              id="edit-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-category">Category</Label>
            <CategoryCombobox
              id="edit-category"
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-type">Type</Label>
              <select id="edit-type" value={type} onChange={(e) => setType(e.target.value as HabitType)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="boolean">Boolean</option>
                <option value="numeric">Numeric</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-target-value">Target value</Label>
              <Input id="edit-target-value" type="number" min={0} step="0.1" value={targetValue} onChange={(e) => setTargetValue(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-target-unit">Unit</Label>
              <Input id="edit-target-unit" value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-frequency">Frequency</Label>
              <select id="edit-frequency" value={frequencyType} onChange={(e) => setFrequencyType(e.target.value as "daily" | "weekly")} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="daily">Daily</option>
                <option value="weekly">Specific days</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-weekly-goal">Weekly goal</Label>
              <Input id="edit-weekly-goal" type="number" min={1} value={weeklyGoal} onChange={(e) => setWeeklyGoal(Number(e.target.value))} />
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

          <div className="flex justify-end">
            <Button type="submit" disabled={updateHabit.isPending}>
              {updateHabit.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Category form ─── */
function CategoryForm() {
  const [open, setOpen] = useState(false)
  const createCategory = useCreateHabitCategory()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    await createCategory.mutateAsync({ name: String(formData.get("name") ?? "") })
    form.reset()
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
        Category
      </Button>
      {open ? (
        <form className="absolute right-0 z-20 mt-2 flex w-72 gap-2 rounded-xl border bg-background p-3 shadow-xl" onSubmit={onSubmit}>
          <Label htmlFor="category-name" className="sr-only">Category name</Label>
          <input id="category-name" name="name" required placeholder="Mindfulness" className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" />
          <Button type="submit" size="icon" aria-label="Create category">
            <Plus className="size-4" />
          </Button>
        </form>
      ) : null}
    </div>
  )
}

/* ─── Create habit form ─── */
function HabitForm({ categories }: { categories: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState("")
  const [frequencyType, setFrequencyType] = useState("daily")
  const [frequencyDays, setFrequencyDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
  const createHabit = useCreateHabit()

  function toggleDay(day: number) {
    setFrequencyDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set("category_id", categoryId)
    formData.set("frequency_days", JSON.stringify(frequencyDays))
    await createHabit.mutateAsync(habitInputFromFormData(formData))
    form.reset()
    setCategoryId("")
    setFrequencyType("daily")
    setFrequencyDays([1, 2, 3, 4, 5, 6, 7])
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button type="button" onClick={() => setOpen((value) => !value)}>
        <Plus className="size-4" />
        Habit
      </Button>
      {open ? (
        <form className="absolute right-0 z-20 mt-2 grid w-[min(92vw,28rem)] gap-3 rounded-xl border bg-background p-4 shadow-xl" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="habit-name">Name</Label>
            <input id="habit-name" name="name" required placeholder="Meditate" className="h-9 rounded-md border bg-background px-3 text-sm" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="habit-category">Category</Label>
            <CategoryCombobox
              id="habit-category"
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="habit-type">Type</Label>
              <select id="habit-type" name="type" defaultValue="boolean" className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="boolean">Boolean</option>
                <option value="numeric">Numeric</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="habit-target-value">Target value</Label>
              <input id="habit-target-value" name="target_value" type="number" min={0} step="0.1" placeholder="Target" className="h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="habit-target-unit">Unit</Label>
              <input id="habit-target-unit" name="target_unit" placeholder="Unit" className="h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="habit-frequency">Frequency</Label>
              <select id="habit-frequency" name="frequency_type" value={frequencyType} onChange={(e) => setFrequencyType(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="daily">Daily</option>
                <option value="weekly">Specific days</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="habit-weekly-goal">Weekly goal</Label>
              <input id="habit-weekly-goal" name="weekly_goal" type="number" min={1} defaultValue={7} className="h-9 rounded-md border bg-background px-3 text-sm" />
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
            <Label htmlFor="habit-description">Description</Label>
            <textarea id="habit-description" name="description" rows={2} placeholder="Description" className="rounded-md border bg-background px-3 py-2 text-sm" />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={createHabit.isPending}>Create habit</Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

/* ─── Searchable category combobox ─── */
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
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(
    () => categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [categories, search],
  )

  const selected = categories.find((c) => c.id === value)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 text-sm text-left"
      >
        <span className={selected ? "" : "text-muted-foreground"}>{selected?.name ?? "Select category"}</span>
        <Search className="size-4 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-xl border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="p-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No categories found</li>
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

/* ─── Habit card ─── */
function HabitCard({
  habit,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  habit: Habit
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const logHabit = useLogHabit()
  const today = new Date().toISOString().slice(0, 10)
  const completed = isCompletedToday(habit)
  const progress = habit.type === "numeric" && habit.target_value ? Math.min(100, ((habit.today_log?.value ?? 0) / habit.target_value) * 100) : completed ? 100 : 0

  async function toggleBoolean() {
    await logHabit.mutateAsync({
      habitId: habit.id,
      input: { logged_date: today, value: completed ? 0 : 1 },
    })
  }

  async function onNumericSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    await logHabit.mutateAsync({
      habitId: habit.id,
      input: { logged_date: today, value: Number(formData.get("value") ?? 0) },
    })
  }

  return (
    <article className={`rounded-xl border p-4 ${selected ? "bg-muted" : "bg-background"}`} onClick={onSelect}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{habit.name}</h3>
          <p className="text-sm text-muted-foreground">{habit.description || habit.target_unit || habit.type}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(habit)}`}>{statusLabel(habit)}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Edit">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded p-1 text-muted-foreground hover:text-destructive" title="Delete">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {habit.type === "boolean" ? (
        <Button className="mt-4 w-full" type="button" variant={completed ? "outline" : "default"} onClick={toggleBoolean}>
          {completed ? "Checked" : "Check in"}
        </Button>
      ) : (
        <form className="mt-4 grid gap-2" onClick={(e) => e.stopPropagation()} onSubmit={onNumericSubmit}>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex gap-2">
            <input name="value" type="number" step="0.1" defaultValue={habit.today_log?.value ?? ""} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" />
            <Button type="submit" variant="outline">Save</Button>
          </div>
        </form>
      )}
    </article>
  )
}

function DailyRing({ habits }: { habits: Habit[] }) {
  const completed = habits.filter(isCompletedToday).length
  const total = habits.length
  const percent = total ? Math.round((completed / total) * 100) : 0

  return (
    <div className="rounded-xl border bg-background p-4 text-center">
      <h2 className="font-semibold">Today</h2>
      <div className="mx-auto mt-4 grid size-32 place-items-center rounded-full border-8 border-primary/25">
        <div>
          <p className="text-2xl font-semibold">{percent}%</p>
          <p className="text-xs text-muted-foreground">{completed}/{total}</p>
        </div>
      </div>
    </div>
  )
}

function HabitAnalyticsPanel({ habit }: { habit: Habit }) {
  const analyticsQuery = useHabitAnalytics(habit.id)
  const analytics = analyticsQuery.data?.analytics

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-4" />
        <h2 className="font-semibold">{habit.name}</h2>
      </div>
      {analytics ? (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Metric label="30 days" value={`${analytics.completion_rate_30}%`} />
            <Metric label="90 days" value={`${analytics.completion_rate_90}%`} />
            <Metric label="Current streak" value={`${analytics.current_streak}`} />
            <Metric label="Longest streak" value={`${analytics.longest_streak}`} />
          </div>
          <div className="grid grid-cols-15 gap-1">
            {analytics.daily_completion.slice(-30).map((day) => (
              <div key={day.date} title={`${day.date}: ${day.value}`} className={`aspect-square rounded-sm ${day.completed ? "bg-green-600" : day.value > 0 ? "bg-yellow-400" : "bg-muted"}`} />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Loading analytics...</p>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function groupHabits(habits: Habit[]): Array<{ categoryName: string; habits: Habit[] }> {
  const groups = new Map<string, Habit[]>()
  for (const habit of habits) {
    const current = groups.get(habit.category_name) ?? []
    current.push(habit)
    groups.set(habit.category_name, current)
  }
  return Array.from(groups.entries()).map(([categoryName, items]) => ({ categoryName, habits: items }))
}

function isCompletedToday(habit: Habit): boolean {
  if (!habit.today_log) return false
  if (habit.type === "boolean") return habit.today_log.value >= 1
  if (habit.target_value === null) return habit.today_log.value > 0
  return habit.today_log.value >= habit.target_value
}

function statusLabel(habit: Habit): string {
  if (isCompletedToday(habit)) return "Met"
  if (habit.type === "numeric" && (habit.today_log?.value ?? 0) > 0) return "Partial"
  return "Open"
}

function statusClass(habit: Habit): string {
  if (isCompletedToday(habit)) return "bg-green-100 text-green-800"
  if (habit.type === "numeric" && (habit.today_log?.value ?? 0) > 0) return "bg-yellow-100 text-yellow-800"
  return "bg-muted text-muted-foreground"
}

function habitInputFromFormData(formData: FormData): CreateHabitInput {
  const habitType = String(formData.get("type") ?? "boolean") as HabitType
  const targetValue = Number(formData.get("target_value") ?? 0)
  const freqDaysRaw = formData.get("frequency_days")
  const frequencyDays: number[] = freqDaysRaw ? JSON.parse(String(freqDaysRaw)) : [1, 2, 3, 4, 5, 6, 7]
  return {
    category_id: String(formData.get("category_id") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    type: habitType,
    target_value: targetValue > 0 ? targetValue : undefined,
    target_unit: String(formData.get("target_unit") ?? ""),
    frequency_type: String(formData.get("frequency_type") ?? "daily") === "weekly" ? "weekly" : "daily",
    frequency_days: frequencyDays,
    weekly_goal: Number(formData.get("weekly_goal") ?? 7),
    sort_order: 0,
  }
}