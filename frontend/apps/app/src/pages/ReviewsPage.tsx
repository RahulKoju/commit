import { CalendarCheck, FileText } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"

import { useCreateReview, useReviews } from "@/hooks/useReviews"
import type { CreateReviewInput, Review, ReviewType } from "@/types/review.types"

export function ReviewsPage() {
  const [typeFilter, setTypeFilter] = useState<ReviewType | "">("")
  const reviewsQuery = useReviews(typeFilter)
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
  const selectedReview = useMemo(
    () => reviewsQuery.data?.data.find((review) => review.id === selectedReviewId) ?? reviewsQuery.data?.data[0] ?? null,
    [reviewsQuery.data?.data, selectedReviewId]
  )
  const prompt = reviewPrompt()

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Capture weekly and monthly reflections backed by generated metrics.
          </p>
        </div>
        {prompt ? (
          <div className="rounded-xl border bg-background px-4 py-3 text-sm">
            <p className="font-medium">{prompt}</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <aside className="space-y-6">
          <ReviewForm />

          <div className="rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Past reviews</h2>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as ReviewType | "")}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">All</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="grid gap-2">
              {reviewsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading reviews...</p> : null}
              {reviewsQuery.data?.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : null}
              {reviewsQuery.data?.data.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  className={`rounded-lg border p-3 text-left text-sm ${
                    selectedReview?.id === review.id ? "bg-muted" : "bg-background hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedReviewId(review.id)}
                >
                  <p className="font-medium capitalize">{review.type} review</p>
                  <p className="text-muted-foreground">
                    {review.period_start} to {review.period_end}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="rounded-xl border bg-background p-4">
          {selectedReview ? (
            <ReviewDetail review={selectedReview} />
          ) : (
            <div className="grid min-h-80 place-items-center text-center text-sm text-muted-foreground">
              Create or select a review.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ReviewForm() {
  const createReview = useCreateReview()
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const formData = new FormData(form)
    const input = reviewInputFromFormData(formData)

    try {
      await createReview.mutateAsync(input)
      form.reset()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create review")
    }
  }

  return (
    <form className="rounded-xl border bg-background p-4" onSubmit={onSubmit}>
      <div className="flex items-center gap-2">
        <CalendarCheck className="size-4" />
        <h2 className="font-semibold">Create review</h2>
      </div>
      <div className="mt-4 grid gap-3">
        <select name="type" defaultValue="weekly" className="h-10 rounded-md border bg-background px-3 text-sm">
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Period start</span>
            <input name="period_start" type="date" className="h-10 rounded-md border bg-background px-3" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Period end</span>
            <input name="period_end" type="date" className="h-10 rounded-md border bg-background px-3" />
          </label>
        </div>
        <textarea
          name="reflection_text"
          rows={5}
          placeholder="What worked, what slipped, and what changes next?"
          className="rounded-md border bg-background px-3 py-2 text-sm"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={createReview.isPending}>
          <FileText className="size-4" />
          {createReview.isPending ? "Creating..." : "Create review"}
        </Button>
      </div>
    </form>
  )
}

function ReviewDetail({ review }: { review: Review }) {
  return (
    <article className="space-y-6">
      <div>
        <p className="text-sm font-medium capitalize text-muted-foreground">{review.type} review</p>
        <h2 className="text-2xl font-semibold">
          {review.period_start} to {review.period_end}
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Tasks completed" value={String(review.data.tasks_completed)} />
        <Metric label="Study hours" value={String(review.data.total_study_hours)} />
        <Metric label="Focus sessions" value={String(review.data.focus_sessions_count)} />
        <Metric label="Focus hours" value={String(review.data.total_focus_hours)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <h3 className="font-semibold">Habit hits and misses</h3>
          <div className="grid gap-2">
            {review.data.habit_hits.map((habit) => (
              <div key={habit.habit_id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{habit.habit_name}</p>
                  <span className="text-muted-foreground">{habit.completed_days}/{habit.logged_days || 7}</span>
                </div>
                <p className="text-muted-foreground">{habit.category_name} · {habit.trend}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Learning highlights</h3>
          <div className="grid gap-2">
            {review.data.top_studied_topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No study entries in this period.</p>
            ) : null}
            {review.data.top_studied_topics.map((topic) => (
              <div key={topic.topic_id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{topic.topic_name}</p>
                <p className="text-muted-foreground">{topic.total_minutes} minutes</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Best habit" value={review.data.best_habit ?? "None"} />
        <Metric label="Most missed habit" value={review.data.most_missed_habit ?? "None"} />
      </div>

      <section className="rounded-xl border bg-muted/30 p-4">
        <h3 className="font-semibold">Reflection</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {review.reflection_text || "No reflection saved."}
        </p>
      </section>
    </article>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function reviewInputFromFormData(formData: FormData): CreateReviewInput {
  return {
    type: String(formData.get("type") ?? "weekly") as ReviewType,
    period_start: String(formData.get("period_start") ?? ""),
    period_end: String(formData.get("period_end") ?? ""),
    reflection_text: String(formData.get("reflection_text") ?? ""),
  }
}

function reviewPrompt(): string | null {
  const now = new Date()
  if (now.getDay() === 1) return "Weekly review is due today."
  if (now.getDate() === 1) return "Monthly review is due today."
  return null
}
