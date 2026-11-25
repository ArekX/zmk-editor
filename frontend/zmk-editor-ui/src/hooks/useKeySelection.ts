import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react"
import { toast } from "sonner"

import type { Keymap } from "@/api/types"
import { setBindings, swapBindings, type KeyRef } from "@/lib/zmk/edit"

function inTextField(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
}

interface Clip {
  /** Copied keys (positions) and their bindings, in key order. */
  keys: number[]
  bindings: string[]
}

/**
 * Key selection on the layers canvas: a single key opens the binding
 * editor; Shift/Cmd/Ctrl-click builds a multi-selection; copy/paste work
 * on either; swap mode exchanges two keys, also across layers.
 */
export function useKeySelection({
  keymap,
  layer,
  update,
}: {
  keymap: Keymap
  layer: number
  update: (fn: (km: Keymap) => Keymap) => void
}) {
  const [selected, setSelected] = useState<number[]>([])
  const [swapping, setSwapping] = useState(false)
  const [swapSource, setSwapSource] = useState<KeyRef | null>(null)
  const [clip, setClip] = useState<Clip | null>(null)
  const layerBindings = keymap.layers[layer]?.bindings
  const bindings = useMemo(() => layerBindings ?? [], [layerBindings])

  const single = selected.length === 1 ? selected[0] : null

  const clear = useCallback(() => setSelected([]), [])

  const cancelSwap = useCallback(() => {
    setSwapping(false)
    setSwapSource(null)
  }, [])

  const startSwap = useCallback(
    (from?: KeyRef) => {
      setSwapping(true)
      setSwapSource(from ?? null)
      clear()
    },
    [clear],
  )

  const onKeyClick = useCallback(
    (key: number, e: MouseEvent) => {
      if (swapping) {
        if (!swapSource) {
          setSwapSource({ layer, key })
          return
        }
        if (swapSource.layer === layer && swapSource.key === key) {
          setSwapSource(null)
          return
        }
        const from = swapSource
        update((km) => swapBindings(km, from, { layer, key }))
        // Stay in swap mode for the next pair until it is turned off.
        setSwapSource(null)
        return
      }
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
        return
      }
      setSelected((s) => (s.length === 1 && s[0] === key ? [] : [key]))
    },
    [swapping, swapSource, layer, update],
  )

  const onDragKey = useCallback(
    (from: number, to: number, copy: boolean) => {
      if (from === to) return
      if (copy) update((km) => setBindings(km, layer, [to], [km.layers[layer].bindings[from]]))
      else update((km) => swapBindings(km, { layer, key: from }, { layer, key: to }))
    },
    [layer, update],
  )

  const copy = useCallback(() => {
    if (selected.length === 0) return false
    const keys = [...selected].sort((a, b) => a - b)
    const next = { keys, bindings: keys.map((k) => bindings[k]) }
    setClip(next)
    void navigator.clipboard?.writeText(next.bindings.join("\n")).catch(() => {})
    toast.success(keys.length === 1 ? `Copied ${next.bindings[0]}` : `Copied ${keys.length} keys`)
    return true
  }, [selected, bindings])

  /**
   * One copied binding goes onto every selected key. Several copied keys
   * land on the same positions (e.g. copying a block between layers).
   */
  const paste = useCallback(() => {
    const c = clip
    if (!c) return false
    if (c.bindings.length === 1) {
      if (selected.length === 0) return false
      update((km) => setBindings(km, layer, selected, c.bindings))
      return true
    }
    update((km) => setBindings(km, layer, c.keys, c.bindings))
    setSelected(c.keys)
    return true
  }, [clip, selected, layer, update])

  const setSelection = useCallback(
    (value: string) => update((km) => setBindings(km, layer, selected, [value])),
    [selected, layer, update],
  )

  // Clear selection when switching layers, but keep a pending swap.
  const [prevLayer, setPrevLayer] = useState(layer)
  if (prevLayer !== layer) {
    setPrevLayer(layer)
    setSelected([])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inTextField(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (e.key === "Escape") {
        if (swapping && swapSource) setSwapSource(null)
        else if (swapping) cancelSwap()
        else if (selected.length > 1) clear()
        return
      }
      if (mod && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) {
        if (copy()) e.preventDefault()
      } else if (mod && e.key.toLowerCase() === "v") {
        if (paste()) e.preventDefault()
      } else if (mod && e.key.toLowerCase() === "a" && document.activeElement === document.body) {
        e.preventDefault()
        setSelected(bindings.map((_, i) => i))
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected.length > 1) {
        e.preventDefault()
        setSelection("&trans")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [swapping, swapSource, selected, bindings, copy, paste, clear, cancelSwap, setSelection])

  return {
    selected,
    single,
    setSelected,
    clear,
    swapping,
    swapSource,
    startSwap,
    cancelSwap,
    onKeyClick,
    onDragKey,
    copy,
    paste,
    setSelection,
    clip,
  }
}
