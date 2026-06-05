"use client"
import { useEffect, useRef } from "react"
import Link from "@tiptap/extension-link"
import StarterKit from "@tiptap/starter-kit"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { Bold, Italic, Link2, List, ListOrdered, Unlink } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { normalizeLinkHref } from "@workspace/ui/lib/rich-text"
import { cn } from "@workspace/ui/lib/utils"

type RichTextEditorProps = {
  id: string
  name: string
  placeholder: string
  maxLength: number
  resetToken?: string
}

type ToolbarButtonProps = {
  active?: boolean
  disabled: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}

function ToolbarButton({
  active = false,
  disabled,
  label,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(active ? "border-primary bg-primary text-primary-foreground" : "")}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  )
}

export function RichTextEditor({
  id,
  name,
  placeholder,
  maxLength,
  resetToken,
}: RichTextEditorProps) {
  const lastResetTokenRef = useRef<string | undefined>(undefined)
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: false,
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
        }),
        Link.configure({ openOnClick: false, defaultProtocol: "https" }),
      ],
      content: "",
      editorProps: {
        attributes: {
          class:
            "ProseMirror min-h-32 rounded-b-md border-x border-b bg-background px-3 py-3 text-sm outline-none",
        },
      },
    },
    []
  )

  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      html: e?.getHTML() ?? "",
      textLength: e?.getText().trim().length ?? 0,
      isBoldActive: e?.isActive("bold") ?? false,
      isItalicActive: e?.isActive("italic") ?? false,
      isBulletListActive: e?.isActive("bulletList") ?? false,
      isOrderedListActive: e?.isActive("orderedList") ?? false,
      isLinkActive: e?.isActive("link") ?? false,
      isReady: Boolean(e && !e.isDestroyed),
    }),
  })

  const textLength = editorState?.textLength ?? 0
  const isOverLimit = textLength > maxLength

  useEffect(() => {
    if (!editor || editor.isDestroyed || !resetToken || lastResetTokenRef.current === resetToken) return
    lastResetTokenRef.current = resetToken
    editor.chain().clearContent().run()
  }, [editor, resetToken])

  return (
    <div className="space-y-2">
      <div className="tiptap-editor rounded-md border bg-muted/40">
        <div className="flex flex-wrap gap-2 border-b px-3 py-2">
          <ToolbarButton
            active={editorState?.isBoldActive}
            disabled={!editorState?.isReady}
            label="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editorState?.isItalicActive}
            disabled={!editorState?.isReady}
            label="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editorState?.isBulletListActive}
            disabled={!editorState?.isReady}
            label="Bullet list"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editorState?.isOrderedListActive}
            disabled={!editorState?.isReady}
            label="Numbered list"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editorState?.isLinkActive}
            disabled={!editorState?.isReady}
            label="Add link"
            onClick={() => {
              const prev = editor?.getAttributes("link").href ?? ""
              const url = window.prompt("Enter a URL", prev)
              if (!editor || url === null) return
              if (url.trim().length === 0) {
                editor.chain().focus().unsetLink().run()
                return
              }
              editor.chain().focus().setLink({ href: normalizeLinkHref(url) }).run()
            }}
          >
            <Link2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editorState?.isLinkActive}
            disabled={!editorState?.isLinkActive}
            label="Remove link"
            onClick={() => editor?.chain().focus().unsetLink().run()}
          >
            <Unlink className="size-4" />
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} id={id} aria-describedby={`${id}-hint ${id}-count`} />
      </div>
      {!textLength ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {placeholder}
        </p>
      ) : null}
      <div className="flex items-center justify-between text-xs">
        <p className="text-muted-foreground">Supports bold, italic, lists, and links.</p>
        <p id={`${id}-count`} className={cn(isOverLimit ? "text-destructive" : "text-muted-foreground")}>
          {textLength}/{maxLength} characters
        </p>
      </div>
      <input type="hidden" name={name} value={editorState?.html ?? ""} />
    </div>
  )
}
