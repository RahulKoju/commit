import { Edit3, Eye, Plus, Trash2 } from "lucide-react"
import { useMemo, useState, type FormEvent } from "react"
import { Button } from "@workspace/ui/components/button"
import { RichTextEditor } from "@workspace/ui/components/rich-text-editor"

import { useLearningTopics } from "@/hooks/useLearn"
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "@/hooks/useNotes"
import type { CreateNoteInput, Note } from "@/types/note.types"

export function NotesPage() {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>("new")
  const [preview, setPreview] = useState(false)
  const notesQuery = useNotes(search)
  const topicsQuery = useLearningTopics()
  const notes = notesQuery.data?.notes ?? []
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? notes[0] ?? null,
    [notes, selectedNoteId]
  )
  const activeNote = editingNoteId === "new" ? null : notes.find((note) => note.id === editingNoteId) ?? selectedNote

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSearch(searchInput)
  }

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
          <form className="flex gap-2" onSubmit={onSearchSubmit}>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search notes"
              className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
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
          {preview && activeNote ? (
            <NotePreview note={activeNote} onEdit={() => setPreview(false)} />
          ) : (
            <NoteForm
              note={editingNoteId === "new" ? null : activeNote}
              topics={topicsQuery.data?.topics ?? []}
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
      </div>
      <div
        className="prose prose-sm max-w-none rounded-lg border bg-muted/30 p-4"
        dangerouslySetInnerHTML={{ __html: note.body }}
      />
    </article>
  )
}

function noteInputFromFormData(formData: FormData): CreateNoteInput {
  return {
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    topic_ids: formData.getAll("topic_ids").map((value) => String(value)),
  }
}
