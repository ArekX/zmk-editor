import { useEffect } from "react"

function inTextField(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
}

/** ⌘/Ctrl+S saves, ⌘/Ctrl+Z undoes, ⌘/Ctrl+Shift+Z (or Ctrl+Y) redoes. */
export function useEditorShortcuts(h: { save: () => void; undo: () => void; redo: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === "s") {
        e.preventDefault()
        h.save()
      } else if (k === "z" && !inTextField(e.target)) {
        e.preventDefault()
        if (e.shiftKey) h.redo()
        else h.undo()
      } else if (k === "y" && !inTextField(e.target)) {
        e.preventDefault()
        h.redo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [h])
}

/** Warns before closing the tab with unsaved edits. */
export function useUnloadWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", onBefore)
    return () => window.removeEventListener("beforeunload", onBefore)
  }, [dirty])
}
