import { BookOpen, Plus } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"

import {
  useCreateLearnEntry,
  useCreateLearningTopic,
  useLearnEntries,
  useLearningTopics,
  useLearnSummary,
  useWeakSpots,
} from "@/hooks/useLearn"
import type { CreateLearnEntryInput, StudyDay, TopicStats } from "@/types/learn.types"

export function LearnPage() {
  const topicsQuery = useLearningTopics()
  const entriesQuery = useLearnEntries()
  const weakSpotsQuery = useWeakSpots()
  const summaryQuery = useLearnSummary()
  const createTopic = useCreateLearningTopic()
  const createEntry = useCreateLearnEntry()
  const [topicError, setTopicError] = useState<string | null>(null)
  const [entryError, setEntryError] = useState<string | null>(null)
  const studyDays = summaryQuery.data?.study_days ?? []
  const topicStats = summaryQuery.data?.topic_stats ?? []
  const totalHours = useMemo(
    () => topicStats.reduce((total, item) => total + item.total_minutes, 0) / 60,
    [topicStats]
  )

  async function onCreateTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTopicError(null)
    const form = event.currentTarget
    const formData = new FormData(form)
    const name = String(formData.get("name") ?? "")

    try {
      await createTopic.mutateAsync({ name })
      form.reset()
    } catch (error) {
      setTopicError(error instanceof Error ? error.message : "Unable to create topic")
    }
  }

  async function onCreateEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEntryError(null)
    const form = event.currentTarget
    const formData = new FormData(form)
    const input = entryInputFromFormData(formData)

    try {
      await createEntry.mutateAsync(input)
      form.reset()
    } catch (error) {
      setEntryError(error instanceof Error ? error.message : "Unable to log study entry")
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Learn</h1>
          <p className="text-sm text-muted-foreground">
            Log study time, confidence, and topic progress.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Study streak" value={`${summaryQuery.data?.streak ?? 0} days`} />
          <Metric label="Total hours" value={totalHours.toFixed(1)} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">Log study entry</h2>
            <form className="mt-4 grid gap-4" onSubmit={onCreateEntry}>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Topic</span>
                <select name="topic_id" required className="h-10 rounded-md border bg-background px-3">
                  <option value="">Select a topic</option>
                  {topicsQuery.data?.topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Duration</span>
                  <input
                    name="duration_minutes"
                    type="number"
                    min={1}
                    required
                    className="h-10 rounded-md border bg-background px-3"
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Confidence</span>
                  <select name="confidence" defaultValue="3" className="h-10 rounded-md border bg-background px-3">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="font-medium">Studied at</span>
                  <input name="studied_at" type="datetime-local" className="h-10 rounded-md border bg-background px-3" />
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Note</span>
                <textarea name="note" rows={3} className="rounded-md border bg-background px-3 py-2" />
              </label>
              {entryError ? <p className="text-sm text-destructive">{entryError}</p> : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={createEntry.isPending}>
                  <BookOpen className="size-4" />
                  {createEntry.isPending ? "Logging..." : "Log entry"}
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">Study heatmap</h2>
            <StudyHeatmap days={studyDays} />
          </div>

          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">Per-topic stats</h2>
            <TopicStatsList stats={topicStats} />
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">Create topic</h2>
            <form className="mt-4 flex gap-2" onSubmit={onCreateTopic}>
              <input
                name="name"
                placeholder="Kubernetes"
                required
                className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
              />
              <Button type="submit" size="icon" aria-label="Create topic" disabled={createTopic.isPending}>
                <Plus className="size-4" />
              </Button>
            </form>
            {topicError ? <p className="mt-2 text-sm text-destructive">{topicError}</p> : null}
          </div>

          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">Weak spots</h2>
            <div className="mt-3 grid gap-2">
              {weakSpotsQuery.data?.weak_spots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No weak spots yet.</p>
              ) : null}
              {weakSpotsQuery.data?.weak_spots.map((spot) => (
                <div key={spot.topic_id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{spot.topic_name}</p>
                  <p className="text-muted-foreground">
                    Avg confidence {spot.average_confidence.toFixed(1)} · Last studied{" "}
                    {new Date(spot.last_studied_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-background p-4">
            <h2 className="font-semibold">Recent entries</h2>
            <div className="mt-3 grid gap-2">
              {entriesQuery.data?.data.slice(0, 5).map((entry) => (
                <div key={entry.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{entry.topic_name}</p>
                  <p className="text-muted-foreground">
                    {entry.duration_minutes} min · confidence {entry.confidence} ·{" "}
                    {new Date(entry.studied_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function StudyHeatmap({ days }: { days: StudyDay[] }) {
  const dayMap = useMemo(() => new Map(days.map((day) => [day.date, day.total_minutes])), [days])
  const cells = useMemo(() => recentDateStrings(84), [])

  return (
    <div className="mt-4 grid grid-cols-12 gap-1">
      {cells.map((date) => {
        const minutes = dayMap.get(date) ?? 0
        return (
          <div
            key={date}
            title={`${date}: ${minutes} min`}
            className={`aspect-square rounded-sm ${heatColor(minutes)}`}
          />
        )
      })}
    </div>
  )
}

function TopicStatsList({ stats }: { stats: TopicStats[] }) {
  if (stats.length === 0) {
    return <p className="mt-3 text-sm text-muted-foreground">Create a topic and log a study entry to see stats.</p>
  }

  return (
    <div className="mt-3 grid gap-2">
      {stats.map((item) => (
        <div key={item.topic_id} className="grid gap-1 rounded-lg border p-3 text-sm sm:grid-cols-4">
          <p className="font-medium sm:col-span-1">{item.topic_name}</p>
          <p className="text-muted-foreground">{(item.total_minutes / 60).toFixed(1)} hours</p>
          <p className="text-muted-foreground">Confidence {item.average_confidence.toFixed(1)}</p>
          <p className="text-muted-foreground">{new Date(item.last_studied_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  )
}

function entryInputFromFormData(formData: FormData): CreateLearnEntryInput {
  const studiedAt = String(formData.get("studied_at") ?? "")
  return {
    topic_id: String(formData.get("topic_id") ?? ""),
    duration_minutes: Number(formData.get("duration_minutes") ?? 0),
    confidence: Number(formData.get("confidence") ?? 3),
    note: String(formData.get("note") ?? ""),
    studied_at: studiedAt ? new Date(studiedAt).toISOString() : "",
  }
}

function recentDateStrings(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (count - index - 1))
    return date.toISOString().slice(0, 10)
  })
}

function heatColor(minutes: number): string {
  if (minutes >= 120) return "bg-green-700"
  if (minutes >= 60) return "bg-green-500"
  if (minutes > 0) return "bg-green-300"
  return "bg-muted"
}
