import { parseParam, type BindNode } from "@/lib/zmk/bindings"
import type { Catalog } from "@/lib/zmk/catalog"
import { MODIFIER_FNS } from "@/lib/zmk/keycodes"

// A standard US ANSI keyboard for picking key codes visually.

export interface PickerKey {
  code: string
  label: string
  /** Character produced with Shift. */
  shifted?: string
  /** Width in key units. */
  w?: number
}

const k = (code: string, label: string, shifted?: string, w?: number): PickerKey => ({ code, label, shifted, w })
const letters = (s: string) => s.split("").map((c) => k(c, c))

export const MAIN_ROWS: PickerKey[][] = [
  [k("ESC", "Esc"), ...Array.from({ length: 12 }, (_, i) => k(`F${i + 1}`, `F${i + 1}`))],
  [
    k("GRAVE", "`", "~"),
    ...["1!", "2@", "3#", "4$", "5%", "6^", "7&", "8*", "9(", "0)"].map((s) => k(`N${s[0]}`, s[0], s[1])),
    k("MINUS", "-", "_"),
    k("EQUAL", "=", "+"),
    k("BSPC", "⌫", undefined, 2),
  ],
  [
    k("TAB", "Tab", undefined, 1.5),
    ...letters("QWERTYUIOP"),
    k("LBKT", "[", "{"),
    k("RBKT", "]", "}"),
    k("BSLH", "\\", "|", 1.5),
  ],
  [
    k("CAPS", "Caps", undefined, 1.75),
    ...letters("ASDFGHJKL"),
    k("SEMI", ";", ":"),
    k("SQT", "'", '"'),
    k("RET", "Enter", undefined, 2.25),
  ],
  [
    k("LSHFT", "Shift", undefined, 2.25),
    ...letters("ZXCVBNM"),
    k("COMMA", ",", "<"),
    k("DOT", ".", ">"),
    k("FSLH", "/", "?"),
    k("RSHFT", "Shift", undefined, 2.75),
  ],
  [
    k("LCTRL", "Ctrl", undefined, 1.25),
    k("LGUI", "GUI", undefined, 1.25),
    k("LALT", "Alt", undefined, 1.25),
    k("SPACE", "Space", undefined, 6.25),
    k("RALT", "Alt", undefined, 1.25),
    k("RGUI", "GUI", undefined, 1.25),
    k("K_APP", "Menu", undefined, 1.25),
    k("RCTRL", "Ctrl", undefined, 1.25),
  ],
]

const gap = (w = 1) => k("", "", undefined, w)

export const NAV_ROWS: PickerKey[][] = [
  [k("PSCRN", "PrtSc"), k("SLCK", "ScrLk"), k("PAUSE_BREAK", "Pause")],
  [k("INS", "Ins"), k("HOME", "Home"), k("PG_UP", "PgUp")],
  [k("DEL", "Del"), k("END", "End"), k("PG_DN", "PgDn")],
  [gap(3)],
  [gap(), k("UP", "↑"), gap()],
  [k("LEFT", "←"), k("DOWN", "↓"), k("RIGHT", "→")],
]

export const NUMPAD_ROWS: PickerKey[][] = [
  [k("KP_EQUAL", "="), k("KP_LPAR", "("), k("KP_RPAR", ")"), k("KP_CLEAR", "Clear")],
  [k("KP_NUM", "Num"), k("KP_SLASH", "/"), k("KP_ASTERISK", "*"), k("KP_MINUS", "-")],
  [k("KP_N7", "7"), k("KP_N8", "8"), k("KP_N9", "9"), k("KP_PLUS", "+")],
  [k("KP_N4", "4"), k("KP_N5", "5"), k("KP_N6", "6"), k("KP_COMMA", ",")],
  [k("KP_N1", "1"), k("KP_N2", "2"), k("KP_N3", "3"), k("KP_ENTER", "Ent")],
  [k("KP_N0", "0", undefined, 2), k("KP_DOT", "."), gap()],
]

export const MEDIA_KEYS: PickerKey[] = [
  k("C_PREV", "⏮"),
  k("C_PP", "⏯"),
  k("C_NEXT", "⏭"),
  k("C_MUTE", "🔇"),
  k("C_VOL_DN", "🔉"),
  k("C_VOL_UP", "🔊"),
  k("C_BRI_DN", "☀-"),
  k("C_BRI_UP", "☀+"),
]

export interface KeyGroup {
  title: string
  keys: PickerKey[]
}

const CONTEXT_GROUPS: Record<string, string> = {
  Keypad: "Keypad",
  Consumer: "Media and device",
  "Consumer Media": "Media sources",
  "Consumer Menu": "Menu and TV",
  "Consumer AL": "Launch apps",
  "Consumer AC": "App controls",
  "Consumer KBIA": "Input assist",
}

/**
 * Every ZMK key code that is not on the picker keyboard, one entry per
 * key (aliases merged), grouped for a list below the keyboard.
 */
export function extraKeyGroups(catalog: Catalog): KeyGroup[] {
  const shown = new Set<string>()
  for (const key of [...MAIN_ROWS, ...NAV_ROWS, ...NUMPAD_ROWS].flat().concat(MEDIA_KEYS)) {
    for (const a of catalog.keycode.get(key.code)?.aliases ?? []) shown.add(a)
  }
  const groups = new Map<string, PickerKey[]>()
  const seen = new Set<string[]>()
  for (const kc of catalog.keycodes) {
    if (kc.isModifierFn || kc.isModifier || seen.has(kc.aliases)) continue
    seen.add(kc.aliases)
    if (kc.aliases.some((a) => shown.has(a))) continue
    const code = [...kc.aliases].sort((a, b) => a.length - b.length)[0]
    const label = kc.symbol !== code ? kc.symbol : kc.description.replace(/\s*\(.*\)$/, "")
    const title =
      kc.context === "Keyboard"
        ? /^F\d+$/.test(code)
          ? "Function keys"
          : /^(INT|LANG)/.test(code)
            ? "International"
            : kc.symbol !== code && [...kc.symbol].length <= 2
              ? "Symbols"
              : "Editing and system"
        : (CONTEXT_GROUPS[kc.context] ?? kc.context)
    const list = groups.get(title) ?? []
    list.push(k(code, label))
    groups.set(title, list)
  }
  const order = ["Symbols", "Function keys", "Editing and system", "Media and device", "Keypad", "International"]
  const rank = (t: string) => (order.includes(t) ? order.indexOf(t) : order.length)
  return [...groups].map(([title, keys]) => ({ title, keys })).sort((a, b) => rank(a.title) - rank(b.title))
}

const MOD_CODES = new Set<string>(MODIFIER_FNS.map((m) => m.code))

/**
 * Parses what the user typed as a ZMK key code: `A`, `lc(ls(a))`,
 * `&kp LC(A)`, `0x04`. Returns an error message for unknown names.
 */
export function parseKeycodeText(text: string, catalog: Catalog): BindNode | string {
  let t = text.trim().replace(/^&kp\s+/i, "")
  if (!t) return "Type a key code"
  if (/\s/.test(t.replace(/\(.*\)/, ""))) return "One key code, e.g. LC(LS(A))"
  t = t.toUpperCase().replace(/\s+/g, "")
  const node = parseParam(t)
  const check = (n: BindNode): string | null => {
    if (n.params.length > 0) {
      if (!MOD_CODES.has(n.value)) return `${n.value}(...) is not a modifier function (LC, LS, LA, LG, RC, RS, RA, RG)`
      if (n.params.length !== 1) return `${n.value}(...) takes one key`
      return check(n.params[0])
    }
    if (/^(0X[0-9A-F]+|\d+)$/.test(n.value)) return null
    return catalog.keycode.has(n.value) ? null : `Unknown key code ${n.value}`
  }
  const err = check(node)
  return err ?? node
}

/** True when two codes name the same key (A and A, RET and ENTER). */
export function sameKey(a: string, b: string, catalog: Catalog): boolean {
  if (a === b) return true
  const ka = catalog.keycode.get(a)
  return !!ka && ka.aliases.includes(b)
}
