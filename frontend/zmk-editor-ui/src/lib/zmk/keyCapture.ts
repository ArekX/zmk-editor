// Maps KeyboardEvent.code to ZMK keycodes for "press a key" capture.

const MAP: Record<string, string> = {
  Enter: "RET", Escape: "ESC", Backspace: "BSPC", Tab: "TAB", Space: "SPACE",
  Minus: "MINUS", Equal: "EQUAL", BracketLeft: "LBKT", BracketRight: "RBKT",
  Backslash: "BSLH", Semicolon: "SEMI", Quote: "SQT", Backquote: "GRAVE",
  Comma: "COMMA", Period: "DOT", Slash: "FSLH", CapsLock: "CAPS",
  PrintScreen: "PSCRN", ScrollLock: "SLCK", Pause: "PAUSE_BREAK", Insert: "INS",
  Home: "HOME", PageUp: "PG_UP", Delete: "DEL", End: "END", PageDown: "PG_DN",
  ArrowRight: "RIGHT", ArrowLeft: "LEFT", ArrowDown: "DOWN", ArrowUp: "UP",
  ControlLeft: "LCTRL", ShiftLeft: "LSHFT", AltLeft: "LALT", MetaLeft: "LGUI",
  ControlRight: "RCTRL", ShiftRight: "RSHFT", AltRight: "RALT", MetaRight: "RGUI",
  ContextMenu: "K_APP", IntlBackslash: "NON_US_BSLH",
  NumpadEnter: "KP_ENTER", NumpadAdd: "KP_PLUS", NumpadSubtract: "KP_MINUS",
  NumpadMultiply: "KP_MULTIPLY", NumpadDivide: "KP_DIVIDE", NumpadDecimal: "KP_DOT",
  NumpadEqual: "KP_EQUAL", NumLock: "KP_NUM",
}

export function zmkCodeFor(code: string): string | null {
  if (MAP[code]) return MAP[code]
  let m = code.match(/^Key([A-Z])$/)
  if (m) return m[1]
  m = code.match(/^Digit(\d)$/)
  if (m) return `N${m[1]}`
  m = code.match(/^Numpad(\d)$/)
  if (m) return `KP_N${m[1]}`
  m = code.match(/^F(\d{1,2})$/)
  if (m) return `F${m[1]}`
  return null
}
