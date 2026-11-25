import type { BindNode } from "@/lib/zmk/bindings"
import { MODIFIER_FNS } from "@/lib/zmk/keycodes"

const MOD_CODES: string[] = MODIFIER_FNS.map((m) => m.code)

/** Splits LC(LS(A)) into its modifier functions and the base key. */
export function unwrapModifiers(node: BindNode): { mods: Set<string>; base: BindNode } {
  const mods = new Set<string>()
  let cur = node
  while (MOD_CODES.includes(cur.value) && cur.params.length === 1) {
    mods.add(cur.value)
    cur = cur.params[0]
  }
  return { mods, base: cur }
}

/** Wraps base in modifier functions in canonical order. */
export function wrapModifiers(mods: Set<string>, base: BindNode): BindNode {
  let node = base
  for (const code of [...MOD_CODES].reverse()) {
    if (mods.has(code)) node = { value: code, params: [node] }
  }
  return node
}

/** Modifier keys and the modifier function each one corresponds to. */
const KEY_FN: Record<string, string> = {
  LCTRL: "LC",
  LSHFT: "LS",
  LALT: "LA",
  LGUI: "LG",
  RCTRL: "RC",
  RSHFT: "RS",
  RALT: "RA",
  RGUI: "RG",
}
const FN_KEY: Record<string, string> = Object.fromEntries(Object.entries(KEY_FN).map(([k, f]) => [f, k]))

/** The modifier key for a modifier function (LC -> LCTRL). */
export function modifierKeyOf(fn: string): string | undefined {
  return FN_KEY[fn]
}

/** KeyboardEvent.code of a modifier key -> modifier function. */
export const EVENT_MOD: Record<string, string> = {
  ControlLeft: "LC",
  ShiftLeft: "LS",
  AltLeft: "LA",
  MetaLeft: "LG",
  ControlRight: "RC",
  ShiftRight: "RS",
  AltRight: "RA",
  MetaRight: "RG",
}

/** The modifier function for a modifier key code (any alias), or null. */
export function modifierFnOf(code: string, aliases: string[] = []): string | null {
  for (const c of [code, ...aliases]) if (KEY_FN[c]) return KEY_FN[c]
  return null
}

/**
 * Modifiers pressed on their own: the first (in canonical order) becomes
 * the key and the others wrap it (Ctrl + Shift -> LC(LSHFT)).
 */
export function modifiersAsKey(mods: Set<string>): BindNode | null {
  const order = MOD_CODES.filter((m) => mods.has(m))
  if (order.length === 0) return null
  const [first, ...rest] = order
  return wrapModifiers(new Set(rest), { value: FN_KEY[first], params: [] })
}

/**
 * Toggles a modifier the way holding it on a real keyboard would: with a
 * normal key chosen it wraps that key (A -> LC(A)); with no normal key the
 * modifiers themselves are the key (LCTRL, LC(LSHFT)).
 */
export function toggleModifier(node: BindNode, fn: string, isModifierKey: (code: string) => string | null): BindNode {
  const { mods, base } = unwrapModifiers(node)
  const baseFn = base.params.length === 0 ? isModifierKey(base.value) : null
  const held = new Set(mods)
  if (baseFn) held.add(baseFn)
  if (held.has(fn)) held.delete(fn)
  else held.add(fn)
  if (!baseFn) return wrapModifiers(held, base)
  return modifiersAsKey(held) ?? node
}
