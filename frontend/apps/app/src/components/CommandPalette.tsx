import Fuse from "fuse.js"
import { Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

const pages = [
  { to: "/dashboard", label: "Dashboard", keywords: "home main" },
  { to: "/focus", label: "Focus", keywords: "pomodoro timer" },
  { to: "/tasks", label: "Tasks", keywords: "todo checklist" },
  { to: "/habits", label: "Habits", keywords: "routine tracker" },
  { to: "/notes", label: "Notes", keywords: "writing docs" },
  { to: "/learn", label: "Learn", keywords: "study topics" },
  { to: "/reviews", label: "Reviews", keywords: "retrospective week" },
  { to: "/admin/users", label: "Admin", keywords: "users manage" },
]

const fuse = new Fuse(pages, {
  keys: ["label", "keywords"],
  threshold: 0.4,
})

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery("")
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) return pages
    return fuse.search(query).map((r) => r.item)
  }, [query])

  function handleSelect(item: (typeof pages)[number]) {
    navigate(item.to)
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && results.length > 0) handleSelect(results[0])
              if (e.key === "Escape") setOpen(false)
            }}
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {results.map((item) => (
            <button
              key={item.to}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted"
              onClick={() => handleSelect(item)}
            >
              <span className="font-medium">{item.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{item.to}</span>
            </button>
          ))}
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">No results.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
