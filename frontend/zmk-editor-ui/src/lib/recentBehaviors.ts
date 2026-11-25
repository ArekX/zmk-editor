// The behaviors picked most recently in the binding editor, newest first,
// kept in localStorage so the shortcuts survive reloads.

const KEY = "zmk-editor.recent-behaviors"
const MAX = 5
const DEFAULTS = ["&kp", "&trans", "&none", "&mo", "&mt"]

/** More than shown, so filtering (encoder, macro) still leaves enough. */
const KEEP = 20

let cache: string[] | null = null
const listeners = new Set<() => void>()

export function recentBehaviors(): string[] {
  if (cache) return cache
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null")
    cache = Array.isArray(stored) ? stored.filter((s): s is string => typeof s === "string") : DEFAULTS
  } catch {
    cache = DEFAULTS
  }
  return cache
}

export function noteBehaviorUsed(code: string) {
  const next = [code, ...recentBehaviors().filter((c) => c !== code)].slice(0, KEEP)
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage full or disabled: keep the in-memory list.
  }
  listeners.forEach((l) => l())
}

export function subscribeRecentBehaviors(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const RECENT_BEHAVIORS_SHOWN = MAX
