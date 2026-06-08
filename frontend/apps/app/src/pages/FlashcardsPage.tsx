import { ArrowLeft, BookOpen, Eye, Plus, Pencil, Trash2, X } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"

import { useLearningTopics } from "@/hooks/useLearn"
import { apiFetch } from "@/lib/api"
import type { Flashcard, FlashcardListResponse, FlashcardDueResponse, FlashcardCreateResponse, FlashcardUpdateResponse, FlashcardReviewResponse } from "@/types/flashcard.types"

const QUALITY_LABELS = ["Again", "", "", "Good", "", "Easy"] as const
const QUALITY_SHORT = ["Again", "Hard", "Good", "Easy"] as const
const QUALITY_MAP = [0, 0, 1, 2, 3, 3] as const

export function FlashcardsPage() {
  const topicsQuery = useLearningTopics()
  const [view, setView] = useState<"list" | "study">("list")
  const [cards, setCards] = useState<Flashcard[]>([])
  const [dueCards, setDueCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadCards() {
    setLoading(true)
    try {
      const resp = await apiFetch<FlashcardListResponse>("/api/v1/flashcards")
      setCards(resp.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flashcards")
    } finally {
      setLoading(false)
    }
  }

  async function loadDue() {
    setLoading(true)
    try {
      const resp = await apiFetch<FlashcardDueResponse>("/api/v1/flashcards/due")
      setDueCards(resp.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load due cards")
    } finally {
      setLoading(false)
    }
  }

  useMemo(() => { loadCards(); loadDue() }, [])

  function startStudy() {
    loadDue()
    setCurrentIndex(0)
    setShowAnswer(false)
    setView("study")
  }

  async function handleReview(quality: number) {
    if (currentIndex >= dueCards.length) return
    setReviewing(true)
    try {
      await apiFetch<FlashcardReviewResponse>(`/api/v1/flashcards/${dueCards[currentIndex].id}/review`, {
        method: "POST",
        body: { quality },
      })
      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex((i) => i + 1)
        setShowAnswer(false)
      } else {
        setView("list")
        loadCards()
        loadDue()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed")
    } finally {
      setReviewing(false)
    }
  }

  const currentCard = dueCards[currentIndex]

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {view === "study" ? (
            <Button type="button" variant="ghost" size="icon" onClick={() => setView("list")}>
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <div>
            <h1 className="text-2xl font-semibold">Flashcards</h1>
            <p className="text-sm text-muted-foreground">
              {view === "study" ? "Review due cards" : "Create and manage flashcards"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {view === "list" ? (
            <>
              <Button type="button" variant="outline" onClick={startStudy} disabled={dueCards.length === 0 || loading}>
                <BookOpen className="size-4" />
                Study now ({dueCards.length})
              </Button>
              <AddCardButton topics={topicsQuery.data?.topics ?? []} onCreated={() => { loadCards(); loadDue() }} />
            </>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {view === "study" && currentCard ? (
        <div className="mx-auto max-w-2xl space-y-6">
          <p className="text-sm text-muted-foreground text-center">
            {currentIndex + 1} of {dueCards.length}
          </p>
          <div className="min-h-[12rem] rounded-xl border bg-background p-8 text-center">
            <p className="text-lg font-medium">{currentCard.front}</p>
            {showAnswer ? (
              <>
                <hr className="my-6" />
                <p className="text-lg">{currentCard.back}</p>
              </>
            ) : null}
          </div>
          {showAnswer ? (
            <div className="flex flex-wrap justify-center gap-2">
              {QUALITY_SHORT.map((label, i) => {
                const quality = QUALITY_MAP[i]
                return (
                  <Button key={label} type="button" variant="outline" onClick={() => handleReview(quality)} disabled={reviewing}>
                    {label}
                  </Button>
                )
              })}
            </div>
          ) : (
            <div className="text-center">
              <Button type="button" onClick={() => setShowAnswer(true)}>
                <Eye className="size-4" />
                Show answer
              </Button>
            </div>
          )}
        </div>
      ) : view === "study" && dueCards.length === 0 ? (
        <div className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
          No cards due for review. Add more cards or check back later.
        </div>
      ) : null}

      {view === "list" ? (
        <FlashcardList cards={cards} topics={topicsQuery.data?.topics ?? []} loading={loading} onChanged={() => { loadCards(); loadDue() }} />
      ) : null}
    </section>
  )
}

/* ─── List view ─── */
function FlashcardList({ cards, topics, loading, onChanged }: { cards: Flashcard[]; topics: Array<{ id: string; name: string }>; loading: boolean; onChanged: () => void }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading flashcards...</p>
  if (cards.length === 0) return <p className="text-sm text-muted-foreground">No flashcards yet. Create your first card.</p>

  const grouped = useMemo(() => {
    const map = new Map<string, Flashcard[]>()
    for (const card of cards) {
      const key = card.topic_name || "General"
      const current = map.get(key) ?? []
      current.push(card)
      map.set(key, current)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [cards])

  return (
    <div className="space-y-6">
      {grouped.map(([topicName, topicCards]) => (
        <div key={topicName} className="rounded-xl border bg-background p-4">
          <h2 className="font-semibold">{topicName} ({topicCards.length})</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {topicCards.map((card) => (
              <FlashcardItem key={card.id} card={card} topics={topics} onChanged={onChanged} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Single card item ─── */
function FlashcardItem({ card, topics, onChanged }: { card: Flashcard; topics: Array<{ id: string; name: string }>; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const due = new Date(card.next_review_at) <= new Date()

  if (deleting) return <DeleteCard card={card} onDeleted={onChanged} onClose={() => setDeleting(false)} />
  if (editing) return <EditCard card={card} topics={topics} onSaved={onChanged} onClose={() => setEditing(false)} />

  return (
    <div className={`rounded-lg border p-3 text-sm ${due ? "ring-1 ring-primary/30" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{card.front}</p>
          <p className="mt-1 text-muted-foreground line-clamp-2">{card.back}</p>
          {card.topic_name ? <p className="mt-1 text-xs text-muted-foreground">{card.topic_name}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            Due {new Date(card.next_review_at).toLocaleDateString()} · Interval {card.interval_days}d · Reps {card.repetitions}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" onClick={() => setDeleting(true)} className="rounded p-1 text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Edit card ─── */
function EditCard({ card, topics, onSaved, onClose }: { card: Flashcard; topics: Array<{ id: string; name: string }>; onSaved: () => void; onClose: () => void }) {
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [topicId, setTopicId] = useState(card.topic_id ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await apiFetch<FlashcardUpdateResponse>(`/api/v1/flashcards/${card.id}`, {
        method: "PATCH",
        body: { front, back, topic_id: topicId },
      })
      onSaved()
      onClose()
    } catch (err) {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[90vw] max-w-lg rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit card</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Front</span>
            <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={3} required className="rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Back</span>
            <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} required className="rounded-md border bg-background px-3 py-2" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">Topic</span>
            <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="h-10 rounded-md border bg-background px-3">
              <option value="">General</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Delete confirmation ─── */
function DeleteCard({ card, onDeleted, onClose }: { card: Flashcard; onDeleted: () => void; onClose: () => void }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await apiFetch(`/api/v1/flashcards/${card.id}`, { method: "DELETE" })
      onDeleted()
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[90vw] max-w-md rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Delete card</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Permanently delete this flashcard? This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Add card button + modal ─── */
function AddCardButton({ topics, onCreated }: { topics: Array<{ id: string; name: string }>; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const [topicId, setTopicId] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch<FlashcardCreateResponse>("/api/v1/flashcards", {
        method: "POST",
        body: { front, back, topic_id: topicId },
      })
      setFront("")
      setBack("")
      setTopicId("")
      setOpen(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create card")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add card
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="w-[90vw] max-w-lg rounded-xl border bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New flashcard</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Front</span>
                <textarea value={front} onChange={(e) => setFront(e.target.value)} rows={3} required placeholder="Question" className="rounded-md border bg-background px-3 py-2" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Back</span>
                <textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} required placeholder="Answer" className="rounded-md border bg-background px-3 py-2" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Topic</span>
                <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className="h-10 rounded-md border bg-background px-3">
                  <option value="">General</option>
                  {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create"}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
