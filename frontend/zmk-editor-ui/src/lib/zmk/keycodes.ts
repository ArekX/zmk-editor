import type { RawKeycode } from "@/api/types"

export interface Keycode {
  code: string
  aliases: string[]
  description: string
  context: string
  symbol: string
  /** Set for modifier functions such as LC(code). */
  isModifierFn: boolean
  /** Set for plain modifier keys (LSHIFT, RCTRL, ...). */
  isModifier: boolean
}

// Nicer glyphs than the catalogue's for common keys.
const SYMBOLS: Record<string, string> = {
  LCTRL: "⌃", RCTRL: "⌃", LC: "⌃", RC: "⌃",
  LSHFT: "⇧", RSHFT: "⇧", LS: "⇧", RS: "⇧",
  LALT: "⌥", RALT: "⌥", LA: "⌥", RA: "⌥",
  LGUI: "⌘", RGUI: "⌘", LG: "⌘", RG: "⌘",
  BSPC: "⌫", DEL: "⌦", RET: "⏎", SPACE: "␣", TAB: "⇥",
  ESC: "Esc", CAPS: "Caps",
  LEFT: "←", RIGHT: "→", UP: "↑", DOWN: "↓",
  PG_UP: "PgUp", PG_DN: "PgDn", HOME: "Home", END: "End", INS: "Ins",
  C_VOL_UP: "🔊", C_VOL_DN: "🔉", C_MUTE: "🔇",
  C_PP: "⏯", C_NEXT: "⏭", C_PREV: "⏮", C_STOP: "⏹",
  C_BRI_UP: "☀+", C_BRI_DN: "☀-",
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`N${i}`, String(i)])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`NUMBER_${i}`, String(i)])),
}

const MOD_FN = /^(.+?)\(code\)$/

// "# [Hash / Pound]", "- [Minus] and _ [Underscore]", "ろ (International 1)",
// keypad "1": the character the key types, from the catalogue description.
const DESC_SYMBOL = /^(\S{1,4}) [[(]/

function descriptionSymbol(description: string): string | undefined {
  if ([...description].length === 1) return description
  return description.match(DESC_SYMBOL)?.[1]
}

function shortest(names: string[]): string {
  return [...names].sort((a, b) => a.length - b.length)[0]
}

/** Expands the ZMK keycode catalogue into one entry per alias. */
export function normalizeKeycodes(raw: RawKeycode[]): Keycode[] {
  const out: Keycode[] = []
  for (const k of raw) {
    const aliases = k.names.filter((n) => !MOD_FN.test(n))
    const fn = k.names.map((n) => n.match(MOD_FN)).find(Boolean)
    const short = shortest(aliases)
    const symbol = SYMBOLS[short] ?? k.symbol ?? descriptionSymbol(k.description) ?? short
    for (const code of aliases) {
      out.push({
        code,
        aliases,
        description: k.description,
        context: k.context,
        symbol: SYMBOLS[code] ?? symbol,
        isModifierFn: false,
        isModifier: !!fn,
      })
    }
    if (fn) {
      out.push({
        code: fn[1],
        aliases: [fn[1]],
        description: `${k.description} + key`,
        context: k.context,
        symbol: SYMBOLS[fn[1]] ?? symbol,
        isModifierFn: true,
        isModifier: false,
      })
    }
  }
  return out
}

/** The eight modifier functions in display order. */
export const MODIFIER_FNS = [
  { code: "LC", label: "Ctrl", symbol: "⌃", side: "L" },
  { code: "LS", label: "Shift", symbol: "⇧", side: "L" },
  { code: "LA", label: "Alt", symbol: "⌥", side: "L" },
  { code: "LG", label: "GUI", symbol: "⌘", side: "L" },
  { code: "RC", label: "Ctrl", symbol: "⌃", side: "R" },
  { code: "RS", label: "Shift", symbol: "⇧", side: "R" },
  { code: "RA", label: "Alt", symbol: "⌥", side: "R" },
  { code: "RG", label: "GUI", symbol: "⌘", side: "R" },
] as const
