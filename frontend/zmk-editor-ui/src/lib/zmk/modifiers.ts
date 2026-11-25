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
