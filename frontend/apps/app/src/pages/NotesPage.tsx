import DOMPurify from "dompurify"
import { Edit3, Eye, Link2, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"
import { RichTextEditor } from "@workspace/ui/components/rich-text-editor"

import { useCreateNote, useDeleteNote, useNoteBacklinks, useNotes, useUpdateNote } from "@/hooks/useNotes"
import { RemindersSection } from "@/components/RemindersSection"
import type { CreateNoteInput, Note } from "@/types/note.types"

export function NotesPage() {
  const [search, setSearch] = useState("")
  const notesQuery = useNotes(search)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>("new")
  const [preview, setPreview] = useState(true)
  const notes = notesQuery.data?.data ?? []
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null,
    [notes, selectedNoteId]
  )
  const activeNote = editingNoteId === "new" ? null : notes.find((note) => note.id === editingNoteId) ?? selectedNote
  const deleteNote = useDeleteNote()

  async function handleDelete() {
    if (!activeNote) return
    await deleteNote.mutateAsync(activeNote.id)
    const remaining = notes.filter((note) => note.id !== activeNote.id)
    if (remaining.length > 0) {
      setSelectedNoteId(remaining[0].id)
      setEditingNoteId(remaining[0].id)
    } else {
      setSelectedNoteId(null)
      setEditingNoteId("new")
    }
    setPreview(true)
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notes</h1>
          <p className="text-sm text-muted-foreground">
            Search, edit, and preview developer notes.
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
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-xl border bg-background p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {editingNoteId === "new" ? "New note" : activeNote?.title ?? "Note"}
              </h2>
              {activeNote ? (
                <p className="text-sm text-muted-foreground">
                  Updated {new Date(activeNote.updated_at).toLocaleString()}
                </p>
              ) : null}
            </div>
            {activeNote ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center overflow-hidden rounded-md border bg-background">
                  <Button
                    type="button"
                    variant={preview ? "default" : "ghost"}
                    className={`rounded-none ${preview ? "" : "text-muted-foreground"}`}
                    onClick={() => setPreview(true)}
                  >
                    <Eye className="size-4" />
                    View
                  </Button>
                  <Button
                    type="button"
                    variant={!preview ? "default" : "ghost"}
                    className={`rounded-none ${!preview ? "" : "text-muted-foreground"}`}
                    onClick={() => setPreview(false)}
                  >
                    <Edit3 className="size-4" />
                    Edit
                  </Button>
                </div>
                <Button type="button" variant="outline" onClick={handleDelete}>
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
          {preview && activeNote ? (
            <NotePreview note={activeNote} />
          ) : (
            <NoteForm
              note={editingNoteId === "new" ? null : activeNote}
              onSaved={(note) => {
                setSelectedNoteId(note.id)
                setEditingNoteId(note.id)
                setPreview(true)
              }}
            />
          )}
        </div>
      </div>
    </section>
  )
}

function DebouncedSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

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
  onSaved,
}: {
  note: Note | null
  onSaved: (note: Note) => void
}) {
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const [error, setError] = useState<string | null>(null)
  const resetToken = note?.id ?? "new"

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    const input = noteInputFromFormData(formData)

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

function NotePreview({ note }: { note: Note }) {
  const backlinksQuery = useNoteBacklinks(note.id)

  return (
    <article className="space-y-4">
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
      <RemindersSection noteId={note.id} />
    </article>
  )
}

function noteInputFromFormData(formData: FormData): CreateNoteInput {
  return {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
  }
}