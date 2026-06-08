import DOMPurify from "dompurify"
import { Edit3, Eye, Link2, Plus, Trash2, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"
import { RichTextEditor } from "@workspace/ui/components/rich-text-editor"

import { useLearningTopics } from "@/hooks/useLearn"
import { useCreateNote, useDeleteNote, useNoteBacklinks, useNotes, useUpdateNote } from "@/hooks/useNotes"
import type { CreateNoteInput, Note } from "@/types/note.types"

export function NotesPage() {
  const [search, setSearch] = useState("")
  const notesQuery = useNotes(search)
  const topicsQuery = useLearningTopics()
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>("new")
  const [preview, setPreview] = useState(true)
  const notes = notesQuery.data?.data ?? []
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null,
    [notes, selectedNoteId]
  )
  const activeNote = editingNoteId === "new" ? null : notes.find((note) => note.id === editingNoteId) ?? selectedNote

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notes</h1>
          <p className="text-sm text-muted-foreground">
            Search, tag, edit, and preview developer notes.
          </p>
        </div>
        <Button type="button" onClick={() => { setEditingNoteId("new"); setPreview(false) }}>
          <Plus className="size-4" />
          New note
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[20rem_1fr]">
        <aside className="rounded-xl border bg-background p-4">
          <DebouncedSearch value={search} onChange={setSearch} />
          <div className="mt-4 grid gap-2">
            {notesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading notes...</p> : null}
            {notes.length === 0 && !notesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">No notes found.</p>
            ) : null}
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                className={`rounded-lg border p-3 text-left text-sm ${
                  selectedNote?.id === note.id ? "bg-muted" : "bg-background hover:bg-muted/50"
                }`}
                onClick={() => {
                  setSelectedNoteId(note.id)
                  setEditingNoteId(note.id)
                  setPreview(true)
                }}
              >
                <p className="font-medium">{note.title}</p>
                <p className="text-xs text-muted-foreground">{new Date(note.updated_at).toLocaleString()}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.topics.map((topic) => (
                    <span key={topic.id} className="rounded-full border px-2 py-0.5 text-xs">
                      {topic.name}
                    </span>
                  ))}
                  {note.tags.map((tag) => (
                    <span key={tag} className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                      #{tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{editingNoteId === "new" ? "New note" : activeNote?.title ?? "Note"}</h2>
            <div className="flex gap-2">
              <Button type="button" variant={preview ? "default" : "outline"} onClick={() => setPreview(true)}>
                <Eye className="size-4" />
                Preview
              </Button>
              <Button type="button" variant={!preview ? "default" : "outline"} onClick={() => setPreview(false)}>
                <Edit3 className="size-4" />
                Edit
              </Button>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {!preview || !activeNote ? (
              <div className={activeNote && preview ? "xl:col-span-1" : "xl:col-span-2"}>
                <NoteForm
                  note={editingNoteId === "new" ? null : activeNote}
                  topics={topicsQuery.data?.topics ?? []}
                  onSaved={(note) => {
                    setSelectedNoteId(note.id)
                    setEditingNoteId(note.id)
                    setPreview(true)
                  }}
                />
              </div>
            ) : null}
            {preview && activeNote ? (
              <div className={!preview || !activeNote ? "xl:col-span-2" : "xl:col-span-1"}>
                <NotePreview note={activeNote} onEdit={() => setPreview(false)} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function DebouncedSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    timer.current = setTimeout(() => onChange(local), 300)
    return () => clearTimeout(timer.current)
  }, [local, onChange])

  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder="Search notes"
      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
    />
  )
}

function NoteForm({
  note,
  topics,
  onSaved,
}: {
  note: Note | null
  topics: Array<{ id: string; name: string }>
  onSaved: (note: Note) => void
}) {
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>(note?.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const resetToken = note?.id ?? "new"

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
    }
    setTagInput("")
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    const input = noteInputFromFormData(formData, tags)

    try {
      const response = note
        ? await updateNote.mutateAsync({ id: note.id, input })
        : await createNote.mutateAsync(input)
      onSaved(response.note)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save note")
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="grid gap-2 text-sm">
        <span className="font-medium">Title</span>
        <input
          name="title"
          defaultValue={note?.title ?? ""}
          required
          className="h-10 rounded-md border bg-background px-3"
        />
      </label>
      <div className="grid gap-2 text-sm">
        <span className="font-medium">Topics</span>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <label key={topic.id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
              <input
                type="checkbox"
                name="topic_ids"
                value={topic.id}
                defaultChecked={note?.topics.some((item) => item.id === topic.id) ?? false}
              />
              {topic.name}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-2 text-sm">
        <span className="font-medium">Tags</span>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="Add a tag..."
            className="h-7 min-w-24 rounded-md border bg-background px-2 text-xs"
          />
        </div>
      </div>
      <RichTextEditor
        id="note-body"
        name="body"
        placeholder="Write your note."
        maxLength={8000}
        initialValue={note?.body ?? ""}
        resetToken={resetToken}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" disabled={createNote.isPending || updateNote.isPending}>
          {createNote.isPending || updateNote.isPending ? "Saving..." : "Save note"}
        </Button>
      </div>
    </form>
  )
}

function NotePreview({ note, onEdit }: { note: Note; onEdit: () => void }) {
  const deleteNote = useDeleteNote()
  const backlinksQuery = useNoteBacklinks(note.id)

  async function onDelete() {
    await deleteNote.mutateAsync(note.id)
  }

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">{note.title}</h3>
          <p className="text-sm text-muted-foreground">Updated {new Date(note.updated_at).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onEdit}>
            <Edit3 className="size-4" />
            Edit
          </Button>
          <Button type="button" variant="outline" onClick={onDelete}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {note.topics.map((topic) => (
          <span key={topic.id} className="rounded-full border px-2 py-1 text-xs">
            {topic.name}
          </span>
        ))}
        {note.tags.map((tag) => (
          <span key={tag} className="rounded-full border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
            #{tag}
          </span>
        ))}
      </div>
      <div
        className="prose prose-sm max-w-none rounded-lg border bg-muted/30 p-4"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.body) }}
      />
      {backlinksQuery.data?.backlinks.length ? (
        <div className="rounded-lg border bg-muted/20 p-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="size-3.5" />
            Backlinks ({backlinksQuery.data.backlinks.length})
          </h4>
          <div className="mt-2 grid gap-1">
            {backlinksQuery.data.backlinks.map((link) => (
              <button
                key={link.source_note_id}
                type="button"
                className="rounded px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  const form = document.querySelector(`[data-note-id="${link.source_note_id}"]`)
                  form?.scrollIntoView({ behavior: "smooth" })
                }}
              >
                {link.target_title}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function noteInputFromFormData(formData: FormData, tags: string[]): CreateNoteInput {
  return {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    topic_ids: formData.getAll("topic_ids").map((value) => String(value)),
    tags,
  }
}