import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { toString as cronToString } from "cronstrue"

import { apiFetch } from "@/lib/api"
import { type Reminder } from "@/types/reminder.types"
import { remindersResponseSchema } from "@/types/reminder.types"

// lastFiredCursor tracks the "since" watermark across polls so reminders that
// fire while the tab is hidden are caught up on the next poll (they carry a
// later last_fired_at). It mirrors the backend DueInWindow contract.
let lastFiredCursor: string | null = null

async function pollDueReminders(): Promise<Reminder[]> {
  const query = lastFiredCursor ? `?since=${encodeURIComponent(lastFiredCursor)}` : ""
  const { reminders } = await apiFetch(`/api/v1/reminders/due${query}`, {
    schema: remindersResponseSchema,
  })
  return reminders
}

function fireBrowserNotifications(reminders: Reminder[]) {
  if (reminders.length === 0) return
  if (typeof window === "undefined" || !("Notification" in window)) return

  if (Notification.permission === "default") {
    void Notification.requestPermission()
    return
  }
  if (Notification.permission !== "granted") return

  for (const reminder of reminders) {
    const schedule = reminder.cron
      ? ` (${cronToString(reminder.cron, { throwExceptionOnParseError: false })})`
      : ""
    try {
      new Notification(`Reminder: ${reminder.note_title}`, {
        body: `${reminder.message || "You set a reminder on this note."}${schedule}`,
        tag: `reminder-${reminder.id}`,
      })
    } catch {
      // Notification constructor can throw (e.g. in SSR or restricted contexts);
      // degrade silently.
    }
  }
}

// useReminderNotifications polls /reminders/due every 30s while the app is open
// and fires a browser Notification per due reminder. Permission is requested on
// first poll if it has never been asked. Fired one-time reminders remain
// visible in the note UI (styled muted); this hook only handles the popup.
export function useReminderNotifications(enabled: boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let lastFire = lastFiredCursor

    const tick = async () => {
      if (cancelled) return
      try {
        const reminders = await pollDueReminders()
        if (cancelled || reminders.length === 0) return

        fireBrowserNotifications(reminders)
        lastFire = maxLastFired(reminders, lastFire)
        lastFiredCursor = lastFire
        void queryClient.invalidateQueries({ queryKey: ["notes"] })
      } catch {
        // Network errors are expected on the polling loop; retry next interval.
      }
    }

    void tick()
    const interval = window.setInterval(tick, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [enabled, queryClient])
}

function maxLastFired(reminders: Reminder[], previous: string | null): string {
  let latest = previous ?? ""
  for (const reminder of reminders) {
    if (reminder.last_fired_at && reminder.last_fired_at > latest) {
      latest = reminder.last_fired_at
    }
  }
  return latest
}

export function resetReminderNotificationCursor() {
  lastFiredCursor = null
}