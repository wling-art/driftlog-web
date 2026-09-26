import { useEffect, useRef } from "react"
import { EditorView, basicSetup } from "codemirror"
import { markdown } from "@codemirror/lang-markdown"
import { languages } from "@codemirror/language-data"
import { Compartment, EditorState } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import { oneDark } from "@codemirror/theme-one-dark"
import { useTheme } from "@/lib/theme"

const base = EditorView.theme({
  "&": { height: "100%", fontSize: "14px", backgroundColor: "transparent" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7" },
  ".cm-content": { padding: "16px 0" },
  ".cm-gutters": { backgroundColor: "transparent", border: "none" },
  "&.cm-focused": { outline: "none" },
})

/**
 * Markdown 源码编辑（CodeMirror 6）。粘贴 / 拖进来的图片交给 onUpload，传完插入 ![](url)。
 * 非受控：外部 value 变化（比如切换文章）时才整体替换。
 */
export function MarkdownEditor({
  value,
  onChange,
  onUpload,
  onSave,
}: {
  value: string
  onChange: (v: string) => void
  onUpload: (file: File) => Promise<string>
  onSave: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const themeSlot = useRef(new Compartment())
  const handlers = useRef({ onChange, onUpload, onSave })
  handlers.current = { onChange, onUpload, onSave }
  const { theme } = useTheme()

  useEffect(() => {
    const uploadAll = (files: File[], at: number) => {
      for (const file of files.filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"))) {
        const placeholder = `![正在上传 ${file.name}…]()`
        view.current?.dispatch({ changes: { from: at, insert: `${placeholder}\n` } })
        handlers.current
          .onUpload(file)
          .then((url) =>
            replace(
              placeholder,
              file.type.startsWith("video/")
                ? `::video{src="${url}"}`
                : `![${file.name.replace(/\.\w+$/, "")}](${url})`,
            ),
          )
          .catch(() => replace(placeholder, `<!-- ${file.name} 上传失败 -->`))
      }
    }
    const replace = (from: string, to: string) => {
      const v = view.current
      if (!v) return
      const i = v.state.doc.toString().indexOf(from)
      if (i >= 0) v.dispatch({ changes: { from: i, to: i + from.length, insert: to } })
    }

    view.current = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown({ codeLanguages: languages }),
          EditorView.lineWrapping,
          base,
          themeSlot.current.of(document.documentElement.classList.contains("dark") ? oneDark : []),
          keymap.of([{ key: "Mod-s", preventDefault: true, run: () => (handlers.current.onSave(), true) }]),
          EditorView.updateListener.of(
            (u) => u.docChanged && handlers.current.onChange(u.state.doc.toString()),
          ),
          EditorView.domEventHandlers({
            paste(e, v) {
              const files = [...(e.clipboardData?.files ?? [])]
              if (!files.length) return false
              e.preventDefault()
              uploadAll(files, v.state.selection.main.head)
              return true
            },
            drop(e, v) {
              const files = [...(e.dataTransfer?.files ?? [])]
              if (!files.length) return false
              e.preventDefault()
              uploadAll(files, v.posAtCoords({ x: e.clientX, y: e.clientY }) ?? v.state.doc.length)
              return true
            },
          }),
        ],
      }),
    })
    return () => view.current?.destroy()
    // 只在挂载时建一次编辑器
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value)
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: themeSlot.current.reconfigure(theme === "dark" ? oneDark : []) })
  }, [theme])

  return <div ref={host} className="h-full min-h-[60vh] overflow-hidden [&_.cm-editor]:h-full" />
}
