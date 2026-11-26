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
  LCTRL: "⌃",
  RCTRL: "⌃",
  LC: "⌃",
  RC: "⌃",
  LSHFT: "⇧",
  RSHFT: "⇧",
  LS: "⇧",
  RS: "⇧",
  LALT: "⌥",
  RALT: "⌥",
  LA: "⌥",
  RA: "⌥",
  LGUI: "⌘",
  RGUI: "⌘",
  LG: "⌘",
  RG: "⌘",
  BSPC: "⌫",
  DEL: "⌦",
  RET: "⏎",
  SPACE: "␣",
  TAB: "⇥",
  ESC: "Esc",
  CAPS: "Caps",
  LEFT: "←",
  RIGHT: "→",
  UP: "↑",
  DOWN: "↓",
  PG_UP: "PgUp",
  PG_DN: "PgDn",
  HOME: "Home",
  END: "End",
  INS: "Ins",
  C_VOL_UP: "🔊",
  C_VOL_DN: "🔉",
  C_MUTE: "🔇",
  C_PP: "⏯",
  C_NEXT: "⏭",
  C_PREV: "⏮",
  C_STOP: "⏹",
  C_BRI_UP: "☀+",
  C_BRI_DN: "☀-",
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`N${i}`, String(i)])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`NUMBER_${i}`, String(i)])),
}

// "# [Hash / Pound]", "- [Minus] and _ [Underscore]", "ろ (International 1)",
// keypad "1": the character the key types, from the catalogue description.
const DESC_SYMBOL = /^(\S{1,4}) [[(]/

function descriptionSymbol(description: string): string | undefined {
  if ([...description].length === 1) return description
  return description.match(DESC_SYMBOL)?.[1]
}

/** The shortest of several names (ties keep the first): LPAR over LEFT_PARENTHESIS. */
export function shortestName(names: string[]): string {
  return names.reduce((best, n) => (n.length < best.length ? n : best))
}

// Modifier keys list their function form as a name too: "LC(code)".
const FN_SUFFIX = "(code)"

/**
 * Turns the catalogue (one record per key, listing all its names) into a
 * lookup entry per name. A modifier key also yields its modifier function
 * (LCTRL -> LC), which wraps another key code.
 */
export function normalizeKeycodes(raw: RawKeycode[]): Keycode[] {
  return raw.flatMap((record) => {
    const keyNames = record.names.filter((n) => !n.endsWith(FN_SUFFIX))
    const fnName = record.names.find((n) => n.endsWith(FN_SUFFIX))?.slice(0, -FN_SUFFIX.length)
    const display = shortestName(keyNames)
    const fallback = SYMBOLS[display] ?? record.symbol ?? descriptionSymbol(record.description) ?? display
    const shared = { description: record.description, context: record.context }

    const keys: Keycode[] = keyNames.map((code) => ({
      ...shared,
      code,
      aliases: keyNames,
      symbol: SYMBOLS[code] ?? fallback,
      isModifier: fnName !== undefined,
      isModifierFn: false,
    }))
    if (fnName === undefined) return keys
    return [
      ...keys,
      {
        ...shared,
        code: fnName,
        aliases: [fnName],
        description: `${record.description} + key`,
        symbol: SYMBOLS[fnName] ?? fallback,
        isModifier: false,
        isModifierFn: true,
      },
    ]
  })
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
