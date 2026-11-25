import { useCallback, useMemo, useState } from "react"

import type { Keymap, KeymapDocument } from "@/api/types"

interface State {
  base: string // hash of the document the draft started from
  draft: Keymap | undefined
  past: Keymap[]
  future: Keymap[]
}

const HISTORY = 100

function editable(km: Keymap | undefined): string {
  return km ? JSON.stringify({ layers: km.layers, combos: km.combos }) : ""
}

/**
 * Local editing state for a keymap document with undo/redo. The draft is
 * reset whenever a different document version (hash) arrives, e.g. after
 * a save, pull or reload.
 */
export function useKeymapDraft(doc: KeymapDocument | undefined) {
  const [state, setState] = useState<State>({ base: "", draft: undefined, past: [], future: [] })

  // Derive-state-from-props: adopt a new document version during render.
  const docKey = doc ? `${doc.path}:${doc.hash}` : ""
  if (docKey !== state.base) {
    setState({ base: docKey, draft: doc?.keymap, past: [], future: [] })
  }

  const keymap = state.base === docKey ? state.draft : doc?.keymap

  const update = useCallback((fn: (km: Keymap) => Keymap) => {
    setState((s) => {
      if (!s.draft) return s
      const next = fn(s.draft)
      if (next === s.draft) return s
      return { ...s, draft: next, past: [...s.past.slice(-HISTORY), s.draft], future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    setState((s) => {
      const prev = s.past[s.past.length - 1]
      if (!prev || !s.draft) return s
      return { ...s, draft: prev, past: s.past.slice(0, -1), future: [s.draft, ...s.future] }
    })
  }, [])

  const redo = useCallback(() => {
    setState((s) => {
      const [next, ...rest] = s.future
      if (!next || !s.draft) return s
      return { ...s, draft: next, past: [...s.past, s.draft], future: rest }
    })
  }, [])

  const discard = useCallback(() => {
    setState((s) => ({ ...s, draft: doc?.keymap, past: s.draft ? [...s.past, s.draft] : s.past, future: [] }))
  }, [doc])

  const original = useMemo(() => editable(doc?.keymap), [doc])
  const dirty = useMemo(() => editable(keymap) !== original, [keymap, original])

  return {
    keymap,
    dirty,
    update,
    undo,
    redo,
    discard,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}

export type KeymapDraft = ReturnType<typeof useKeymapDraft>
