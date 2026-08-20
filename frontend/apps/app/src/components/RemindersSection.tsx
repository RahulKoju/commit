import { AlarmClock, BellPlus, Pencil, Trash2 } from "lucide-react"
import { Fragment, useEffect, useMemo, useState } from "react"
import { Button } from "@workspace/ui/components/button"

import { useCreateReminder, useDeleteReminder, useRemindersByNote, useUpdateReminder } from "@/hooks/useReminders"
import {
  DEFAULT_PRESET_FIELDS,
  describeCron,
  detectPreset,
  presetToCron,
  type PresetFields,
  type RecurrencePreset,
} from "@/lib/cron"
import type { Reminder } from "@/types/reminder.types"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

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

function boundedNumber(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function ReminderRow({
  reminder,
  onDelete,
  onEdit,
  onToggleActive,
}: {
  reminder: Reminder
  onDelete: () => void
  onEdit: () => void
  onToggleActive: () => void
}) {
  return (
    <div className={`flex items-start justify-between gap-2 ${reminder.is_active ? "" : "opacity-50"}`}>
      <button
        type="button"
        onClick={onToggleActive}
        className="flex min-w-0 flex-1 items-start gap-2 text-left sm:items-center"
        title={reminder.is_active ? "Click to deactivate" : "Click to reactivate"}
      >
        <input
          type="checkbox"
          checked={reminder.is_active}
          onChange={onToggleActive}
          className="mt-0.5 size-4 sm:mt-0"
        />
        <span className="grid min-w-0 gap-1 sm:flex sm:items-center sm:gap-2">
          <span className={`truncate text-sm ${reminder.is_active ? "" : "line-through"}`}>
            {reminder.message || "Reminder"}
          </span>
          <span className="min-w-0">
            <ReminderBadge reminder={reminder} />
          </span>
        </span>
      </button>
      <div className="flex shrink-0 gap-1">
        <Button type="button" variant="ghost" size="icon" aria-label="Edit reminder" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Delete reminder" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}

export function RemindersSection({ noteId }: { noteId: string }) {
  const remindersQuery = useRemindersByNote(noteId)
  const createReminder = useCreateReminder(noteId)
  const deleteReminder = useDeleteReminder(noteId)
  const updateReminder = useUpdateReminder(noteId)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
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
      setEditingId(null)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create reminder")
      throw createError
    }
  }

  async function handleUpdate(reminder: Reminder, input: { type: "one_time" | "recurring"; fireAt?: string; cron?: string; message: string }) {
    setError(null)
    try {
      await updateReminder.mutateAsync({
        id: reminder.id,
        input: {
          cron: input.type === "recurring" ? input.cron : undefined,
          message: input.message,
        },
      })
      setEditingId(null)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update reminder")
      throw updateError
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
          <Fragment key={reminder.id}>
            <ReminderRow
              reminder={reminder}
              onDelete={() => void handleDelete(reminder)}
              onEdit={() => {
                setAdding(false)
                setEditingId((current) => (current === reminder.id ? null : reminder.id))
              }}
              onToggleActive={() => void handleToggleActive(reminder)}
            />
            {editingId === reminder.id ? (
              <ReminderForm
                existing={reminder}
                onSave={(input) => handleUpdate(reminder, input)}
                onCancel={() => setEditingId(null)}
              />
            ) : null}
          </Fragment>
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
  const initialPreset = existing?.cron ? detectPreset(existing.cron) : { preset: "daily" as const, fields: DEFAULT_PRESET_FIELDS }
  const [type, setType] = useState<"one_time" | "recurring">(existing?.type ?? "recurring")
  const [preset, setPreset] = useState<RecurrencePreset>(initialPreset?.preset ?? "daily")
  const [fields, setFields] = useState<PresetFields>(initialPreset?.fields ?? DEFAULT_PRESET_FIELDS)
  const [cron, setCron] = useState(existing?.cron ?? presetToCron("daily", DEFAULT_PRESET_FIELDS))
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
  const [syncSource, setSyncSource] = useState<"friendly" | "raw" | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const knownPreset = useMemo(() => detectPreset(cron), [cron])

  useEffect(() => {
    if (syncSource !== "friendly" || preset === "custom") return
    let cancelled = false
    const nextCron = presetToCron(preset, fields)
    queueMicrotask(() => {
      if (cancelled) return
      setCron(nextCron)
      setSyncSource(null)
    })
    return () => {
      cancelled = true
    }
  }, [fields, preset, syncSource])

  useEffect(() => {
    if (syncSource !== "raw") return
    const detected = detectPreset(cron)
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setPreset(detected.preset)
      if (detected.fields) {
        setFields(detected.fields)
      }
      setSyncSource(null)
    })
    return () => {
      cancelled = true
    }
  }, [cron, syncSource])

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
    if (nextPreset !== "custom") {
      setSyncSource("friendly")
    }
  }

  function updateFields(nextFields: Partial<PresetFields>) {
    setFields((current) => ({ ...current, ...nextFields }))
    setSyncSource("friendly")
  }

  function updateRawCron(value: string) {
    setCron(value)
    setSyncSource("raw")
  }

  function toggleWeekday(day: number) {
    const next = fields.weekdays.includes(day)
      ? fields.weekdays.filter((value) => value !== day)
      : [...fields.weekdays, day].sort()
    updateFields({ weekdays: next.length > 0 ? next : [day] })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setFormError(null)

    const trimmedMessage = message.trim()
    let input: { type: "one_time" | "recurring"; fireAt?: string; cron?: string; message: string }
    if (type === "one_time") {
      if (!datetime) {
        setFormError("Date and time are required.")
        return
      }
      input = { type, fireAt: new Date(datetime).toISOString(), message: trimmedMessage }
    } else {
      if (!cron.trim()) {
        setFormError("Cron expression is required.")
        return
      }
      input = { type, cron, message: trimmedMessage }
    }

    setSubmitting(true)
    void Promise.resolve(onSave(input))
      .catch((saveError) => {
        setFormError(saveError instanceof Error ? saveError.message : "Unable to save reminder")
      })
      .finally(() => setSubmitting(false))
  }

  const isCustom = preset === "custom" || knownPreset.preset === "custom"

  return (
    <form className="mt-3 space-y-3 rounded-lg border bg-background p-3" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("recurring")}
          disabled={!!existing}
          className={`rounded-md border px-3 py-1 text-sm ${type === "recurring" ? "bg-muted font-medium" : "text-muted-foreground"}`}
        >
          Recurring
        </button>
        <button
          type="button"
          onClick={() => setType("one_time")}
          disabled={!!existing}
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
                <option value="every_minutes">Every N minutes</option>
                <option value="every_hours">Every N hours</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom…</option>
              </select>
            </label>

            {["daily", "weekly", "monthly", "yearly"].includes(preset) ? (
              <>
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Hour</span>
                  <input type="number" min={0} max={23} value={fields.hour} onChange={(e) => updateFields({ hour: boundedNumber(e.target.value, 0, 23, fields.hour) })} className="h-9 rounded-md border bg-background px-2" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Minute</span>
                  <input type="number" min={0} max={59} value={fields.minute} onChange={(e) => updateFields({ minute: boundedNumber(e.target.value, 0, 59, fields.minute) })} className="h-9 rounded-md border bg-background px-2" />
                </label>
              </>
            ) : null}

            {preset === "every_minutes" ? (
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Minutes</span>
                <input type="number" min={1} max={59} value={fields.intervalMinutes} onChange={(e) => updateFields({ intervalMinutes: boundedNumber(e.target.value, 1, 59, fields.intervalMinutes) })} className="h-9 rounded-md border bg-background px-2" />
              </label>
            ) : null}

            {preset === "every_hours" ? (
              <>
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Hours</span>
                  <input type="number" min={1} max={23} value={fields.intervalHours} onChange={(e) => updateFields({ intervalHours: boundedNumber(e.target.value, 1, 23, fields.intervalHours) })} className="h-9 rounded-md border bg-background px-2" />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Minute</span>
                  <input type="number" min={0} max={59} value={fields.minute} onChange={(e) => updateFields({ minute: boundedNumber(e.target.value, 0, 59, fields.minute) })} className="h-9 rounded-md border bg-background px-2" />
                </label>
              </>
            ) : null}

            {preset === "monthly" || preset === "yearly" ? (
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Day</span>
                <input type="number" min={1} max={31} value={fields.dayOfMonth} onChange={(e) => updateFields({ dayOfMonth: boundedNumber(e.target.value, 1, 31, fields.dayOfMonth) })} className="h-9 rounded-md border bg-background px-2" />
              </label>
            ) : null}

            {preset === "yearly" ? (
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">Month</span>
                <select value={fields.month} onChange={(e) => updateFields({ month: Number(e.target.value) })} className="h-9 rounded-md border bg-background px-2">
                  {MONTHS.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {preset === "weekly" ? (
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleWeekday(day)}
                  className={`h-8 rounded-md border px-2 text-xs font-medium ${fields.weekdays.includes(day) ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <label className="grid gap-1 text-sm">
            <span className="text-xs text-muted-foreground">
              Raw cron (single source of truth)
            </span>
            <input
              value={cron}
              onChange={(e) => updateRawCron(e.target.value)}
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

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

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
