import { AlarmClock, BellPlus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"

import { useCreateReminder, useDeleteReminder, useRemindersByNote, useUpdateReminder } from "@/hooks/useReminders"
import { describeCron, detectPreset, presetToCron, type RecurrencePreset } from "@/lib/cron"
import type { Reminder } from "@/types/reminder.types"

function ReminderBadge({ reminder }: { reminder: Reminder }) {
  const [description, setDescription] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (reminder.cron) {
      void describeCron(reminder.cron).then((text) => {
        if (!cancelled) setDescription(text)
      })
    }
    return () => {
      cancelled = true
    }
  }, [reminder.cron])

  const next = new Date(reminder.next_fire_at)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
        reminder.is_active ? "text-foreground" : "text-muted-foreground line-through"
      }`}
    >
      <AlarmClock className="size-3" />
      {reminder.type === "recurring"
        ? description ?? next.toLocaleString()
        : `Once ${next.toLocaleString()}`}
    </span>
  )
}

function ReminderRow({
  reminder,
  onDelete,
  onToggleActive,
}: {
  reminder: Reminder
  onDelete: () => void
  onToggleActive: () => void
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${reminder.is_active ? "" : "opacity-50"}`}>
      <button
        type="button"
        onClick={onToggleActive}
        className="flex min-w-0 items-center gap-2 text-left"
        title={reminder.is_active ? "Click to deactivate" : "Click to reactivate"}
      >
        <input
          type="checkbox"
          checked={reminder.is_active}
          onChange={onToggleActive}
          className="size-4"
        />
        <span className={`truncate text-sm ${reminder.is_active ? "" : "line-through"}`}>
          {reminder.message || "Reminder"}
        </span>
        <ReminderBadge reminder={reminder} />
      </button>
      <Button type="button" variant="ghost" size="icon" aria-label="Delete reminder" onClick={onDelete}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

export function RemindersSection({ noteId }: { noteId: string }) {
  const remindersQuery = useRemindersByNote(noteId)
  const createReminder = useCreateReminder(noteId)
  const deleteReminder = useDeleteReminder(noteId)
  const updateReminder = useUpdateReminder(noteId)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reminders = remindersQuery.data?.reminders ?? []

  async function handleCreate(input: { type: "one_time" | "recurring"; fireAt?: string; cron?: string; message: string }) {
    setError(null)
    try {
      await createReminder.mutateAsync({
        type: input.type,
        fire_at: input.fireAt,
        cron: input.cron,
        message: input.message,
      })
      setAdding(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create reminder")
    }
  }

  async function handleToggleActive(reminder: Reminder) {
    try {
      await updateReminder.mutateAsync({ id: reminder.id, input: { is_active: !reminder.is_active } })
    } catch {
      // Ignore toggle failures; the row will refresh on next invalidation.
    }
  }

  async function handleDelete(reminder: Reminder) {
    try {
      await deleteReminder.mutateAsync(reminder.id)
    } catch {
      // Ignore delete failures.
    }
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <BellPlus className="size-3.5" />
          Reminders ({reminders.length})
        </h4>
        {!adding ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            Add reminder
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2">
        {reminders.map((reminder) => (
          <ReminderRow
            key={reminder.id}
            reminder={reminder}
            onDelete={() => void handleDelete(reminder)}
            onToggleActive={() => void handleToggleActive(reminder)}
          />
        ))}
      </div>

      {adding ? (
        <ReminderForm onSave={handleCreate} onCancel={() => setAdding(false)} />
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

// ReminderForm is a two-way preset/cron editor. The cron string (or fireAt for
// one_time) is the single source of truth: picking a preset rewrites the cron,
// and typing in the raw cron field parses back into a highlighted preset when
// possible, otherwise falls back to "Custom schedule" without erroring.
function ReminderForm({
  existing,
  onSave,
  onCancel,
}: {
  existing?: Reminder
  onSave: (input: { type: "one_time" | "recurring"; fireAt?: string; cron?: string; message: string }) => Promise<void> | void
  onCancel: () => void
}) {
  const initialPreset = existing?.cron ? detectPreset(existing.cron) : null
  const [type, setType] = useState<"one_time" | "recurring">(existing?.type ?? "recurring")
  const [preset, setPreset] = useState<RecurrencePreset>(initialPreset?.preset ?? "daily")
  const [hour, setHour] = useState(initialPreset?.fields?.hour ?? 18)
  const [minute, setMinute] = useState(initialPreset?.fields?.minute ?? 0)
  const [dayOfWeek, setDayOfWeek] = useState(initialPreset?.fields?.dayOfWeek ?? 1)
  const [cron, setCron] = useState(existing?.cron ?? presetToCron("daily", { hour: 18, minute: 0, dayOfWeek: 1 }))
  const [datetime, setDatetime] = useState(() => {
    if (existing?.type === "one_time") {
      const date = new Date(existing.next_fire_at)
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      return local.toISOString().slice(0, 16)
    }
    return ""
  })
  const [message, setMessage] = useState(existing?.message ?? "")
  const [description, setDescription] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const knownPreset = useMemo(() => detectPreset(cron), [cron])

  useEffect(() => {
    let cancelled = false
    void describeCron(cron).then((text) => {
      if (!cancelled) setDescription(text)
    })
    return () => {
      cancelled = true
    }
  }, [cron])

  function applyPreset(nextPreset: RecurrencePreset) {
    setPreset(nextPreset)
    setCron(presetToCron(nextPreset, { hour, minute, dayOfWeek }))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return

    const trimmedMessage = message.trim()
    let input: { type: "one_time" | "recurring"; fireAt?: string; cron?: string; message: string }
    if (type === "one_time") {
      if (!datetime) return
      input = { type, fireAt: new Date(datetime).toISOString(), message: trimmedMessage }
    } else {
      input = { type, cron, message: trimmedMessage }
    }

    setSubmitting(true)
    void Promise.resolve(onSave(input)).finally(() => setSubmitting(false))
  }

  const isCustom = knownPreset.preset === "custom"

  return (
    <form className="mt-3 space-y-3 rounded-lg border bg-background p-3" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("recurring")}
          className={`rounded-md border px-3 py-1 text-sm ${type === "recurring" ? "bg-muted font-medium" : "text-muted-foreground"}`}
        >
          Recurring
        </button>
        <button
          type="button"
          onClick={() => setType("one_time")}
          className={`rounded-md border px-3 py-1 text-sm ${type === "one_time" ? "bg-muted font-medium" : "text-muted-foreground"}`}
        >
          One time
        </button>
      </div>

      {type === "recurring" ? (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Schedule</span>
              <select value={preset} onChange={(e) => applyPreset(e.target.value as RecurrencePreset)} className="h-9 rounded-md border bg-background px-2">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom…</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Hour</span>
              <input type="number" min={0} max={23} value={hour} onChange={(e) => { setHour(Number(e.target.value)); }} className="h-9 rounded-md border bg-background px-2" />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Minute</span>
              <input type="number" min={0} max={59} value={minute} onChange={(e) => { setMinute(Number(e.target.value)); }} className="h-9 rounded-md border bg-background px-2" />
            </label>
            {preset === "weekly" ? (
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Day</span>
                <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))} className="h-9 rounded-md border bg-background px-2">
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <option key={day} value={day}>
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">
              Raw cron (single source of truth)
            </span>
            <input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 18 * * 1,3,5"
              className="h-9 rounded-md border bg-background px-2 font-mono text-xs"
            />
            <span className={`text-xs ${isCustom ? "text-muted-foreground" : "text-foreground"}`}>
              {isCustom
                ? `Custom schedule${description ? `: ${description}` : ""}`
                : description
                  ? description
                  : "Enter a cron expression"}
            </span>
          </label>
        </>
      ) : (
        <label className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Date and time</span>
          <input
            type="datetime-local"
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            className="h-9 rounded-md border bg-background px-2"
          />
        </label>
      )}

      <label className="grid gap-1 text-sm">
        <span className="text-xs text-muted-foreground">Message</span>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Meeting notes review"
          className="h-9 rounded-md border bg-background px-2"
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving…" : "Save reminder"}
        </Button>
      </div>
    </form>
  )
}