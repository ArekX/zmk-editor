import { encodeParam, expandDefines, parseBinding, resolveNumber, type BindNode } from "@/lib/zmk/bindings"
import { paramsFor, type Catalog } from "@/lib/zmk/catalog"
import type { ParamSpec } from "@/lib/zmk/params"

export interface Legend {
  /** Small behavior tag shown in the key's corner ("kp", "hml"). */
  tag: string
  /** Main label (tap action). */
  main: string
  /** Secondary label (hold action), when the behavior is a hold-tap. */
  hold?: string
  /** Tooltip. */
  title: string
  size: "xl" | "lg" | "md" | "sm" | "xs"
  kind: "normal" | "trans" | "none" | "unknown"
  /** CSS colour for RGB_COLOR_HSB(...) parameters. */
  color?: string
}

const HSB = /^RGB_COLOR_HSB(_VAL)?$/

/** Converts ZMK's HSB (h 0-360, s/b 0-100) to a CSS colour. */
export function hsbColor(node: BindNode): string | undefined {
  if (!HSB.test(node.value) || node.params.length !== 3) return undefined
  const [h, s, v] = node.params.map((p) => Number(p.value))
  if ([h, s, v].some((n) => !Number.isFinite(n))) return undefined
  const sv = s / 100
  const vv = v / 100
  const l = vv * (1 - sv / 2)
  const sl = l === 0 || l === 1 ? 0 : (vv - l) / Math.min(l, 1 - l)
  // Lift lightness so dim LED values still read as a colour on screen.
  return `hsl(${h} ${Math.round(sl * 100)}% ${Math.round(Math.max(l, 0.35) * 100)}%)`
}

const SHORT_NAMES: Record<string, string> = {
  "&caps_word": "Caps Word",
  "&key_repeat": "Repeat",
  "&bootloader": "Boot",
  "&sys_reset": "Reset",
  "&soft_off": "Off",
  "&studio_unlock": "Studio",
  "&gresc": "Esc `",
}

export function keycodeText(node: BindNode, catalog: Catalog): string {
  if (node.value === "MACRO_PLACEHOLDER") return "‹param›"
  const kc = catalog.keycode.get(node.value)
  if (node.params.length > 0) {
    const inner = node.params.map((p) => keycodeText(p, catalog)).join(",")
    if (kc?.isModifierFn) return `${kc.symbol}${inner}`
    return `${node.value}(${inner})`
  }
  return kc?.symbol ?? node.value
}

export function paramText(node: BindNode | undefined, spec: ParamSpec | undefined, catalog: Catalog): string {
  if (!node) return "?"
  if (hsbColor(node)) return "HSB"
  switch (spec?.kind) {
    case "layer": {
      const n = resolveNumber(node.value, catalog.defines)
      if (n !== null && catalog.layers[n]) return catalog.layers[n].name
      return node.value
    }
    case "code":
    case "mod":
      return keycodeText(node, catalog)
    default:
      return encodeParam(node)
  }
}

function sizeFor(text: string): Legend["size"] {
  const n = [...text].length
  if (n <= 1) return "xl"
  if (n <= 3) return "lg"
  if (n <= 6) return "md"
  if (n <= 10) return "sm"
  return "xs"
}

export function legendFor(binding: string | undefined, catalog: Catalog): Legend {
  const expanded = expandDefines(binding ?? "&none", catalog.defines)
  const node = parseBinding(expanded)
  const def = catalog.behavior.get(node.value)
  const tag = node.value.replace(/^&/, "")
  const title = def ? `${def.name} - ${expanded}` : expanded

  if (node.value === "&trans") return { tag: "", main: "▽", title: "Transparent", size: "lg", kind: "trans" }
  if (node.value === "&none") return { tag: "", main: "", title: "None", size: "lg", kind: "none" }

  const specs = paramsFor(def, node)
  const chord = def?.custom?.kind === "macro" ? chordText(def.custom.bindings, catalog) : null
  if (chord && node.params.length === 0) {
    return { tag, main: chord, title, size: sizeFor(chord), kind: "normal" }
  }
  if (node.params.length === 0) {
    const main = SHORT_NAMES[node.value] ?? (def?.custom ? tag : (def?.name ?? tag))
    const size = sizeFor(main)
    return { tag: "", main, title, size: size === "xl" ? "lg" : size, kind: def ? "normal" : "unknown" }
  }
  const texts = node.params.map((p, i) => paramText(p, specs[i], catalog))
  const color = node.params.map(hsbColor).find(Boolean)
  if (def?.holdTap && texts.length === 2) {
    return { tag, main: texts[1], hold: texts[0], title, size: sizeFor(texts[1]), kind: "normal", color }
  }
  const main = texts.join(" ")
  return { tag, main, title, size: sizeFor(main), kind: def ? "normal" : "unknown", color }
}

/**
 * For a macro that presses keys together (`&macro_press &kp A &kp B
 * &macro_pause_for_release &macro_release ...`), the keys joined by "+".
 */
function chordText(steps: string[], catalog: Catalog): string | null {
  const t = steps.map((s) => s.trim())
  const pause = t.indexOf("&macro_pause_for_release")
  if (t[0] !== "&macro_press" || pause < 2) return null
  const keys = t.slice(1, pause)
  if (!keys.every((k) => /^&kp \S+$/.test(k))) return null
  return keys.map((k) => keycodeText(parseBinding(k).params[0], catalog)).join("+")
}
