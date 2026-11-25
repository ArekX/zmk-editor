import {
  encodeBinding,
  encodeParam,
  expandDefines,
  parseBinding,
  resolveNumber,
  type BindNode,
} from "@/lib/zmk/bindings"
import { paramsFor, type Catalog } from "@/lib/zmk/catalog"
import { PARAM_PROMPTS } from "@/lib/zmk/params"
import { parseKeycodeText } from "@/lib/zmk/qwerty"

export type BindingCheck = { ok: true; binding: string } | { ok: false; error: string }

/**
 * Checks a binding typed as ZMK devicetree text (`&kp LC(A)`, `&mo 2`,
 * `&hml LGUI A`) the way the firmware build would: the behavior must
 * exist, take that many parameters, and each parameter must be a valid
 * key code, layer or command. Key codes are accepted in any case and
 * normalized.
 */
export function validateBinding(text: string, catalog: Catalog, opts: { sensor?: boolean } = {}): BindingCheck {
  const raw = text.trim().replace(/\s+/g, " ")
  if (!raw) return { ok: false, error: "Type a binding, e.g. &kp A" }
  const expanded = expandDefines(raw, catalog.defines)
  if (!expanded.startsWith("&")) return { ok: false, error: "A binding starts with a behavior, e.g. &kp A" }
  const node = parseBinding(expanded)
  const def = catalog.behavior.get(node.value)
  if (!def) return { ok: false, error: `Unknown behavior ${node.value}` }
  if (def.macro) return { ok: false, error: `${node.value} can only be used inside macros` }
  if (!!opts.sensor !== def.sensor) {
    return {
      ok: false,
      error: opts.sensor ? `${node.value} is not an encoder behavior` : `${node.value} is only for encoders`,
    }
  }
  const specs = paramsFor(def, node)
  if (node.params.length !== specs.length) {
    // Commands written as macros (RGB_COLOR_HSB(...)) expand to more cells.
    const commandMacro = specs[0]?.kind === "command" && node.params.length >= 1 && node.params.length <= 2
    if (!commandMacro) {
      return {
        ok: false,
        error: `${node.value} takes ${specs.length} parameter${specs.length === 1 ? "" : "s"}, got ${node.params.length}`,
      }
    }
  }
  const params: BindNode[] = []
  for (let i = 0; i < node.params.length; i++) {
    const p = node.params[i]
    const spec = specs[i]
    const label = spec ? (spec.name ?? PARAM_PROMPTS[spec.kind]) : `Parameter ${i + 1}`
    const text = encodeParam(p)
    if (p.value === "MACRO_PLACEHOLDER" || p.value in catalog.defines) {
      params.push(p)
      continue
    }
    switch (spec?.kind) {
      case "code":
      case "mod": {
        const r = parseKeycodeText(text, catalog)
        if (typeof r === "string") return { ok: false, error: `${label}: ${r}` }
        params.push(r)
        break
      }
      case "layer": {
        const n = resolveNumber(text, catalog.defines)
        if (n === null) return { ok: false, error: `${label}: ${text} is not a layer number` }
        if (n < 0 || n >= catalog.layers.length) {
          return { ok: false, error: `${label}: layer ${n} does not exist (0-${catalog.layers.length - 1})` }
        }
        params.push(p)
        break
      }
      case "command": {
        const cmds = def.commands ?? []
        const known = cmds.some((c) => c.code === p.value) || p.params.length > 0
        if (!known && i === 0) return { ok: false, error: `${label}: ${p.value} is not a ${node.value} command` }
        params.push(p)
        break
      }
      case "enum": {
        if (spec.values && !spec.values.map(String).includes(text)) {
          return { ok: false, error: `${label}: one of ${spec.values.join(", ")}` }
        }
        params.push(p)
        break
      }
      default:
        params.push(p)
    }
  }
  // Keep a define used as the behavior (`___`) as typed.
  if (expanded !== raw && node.params.length === 0) return { ok: true, binding: raw }
  return { ok: true, binding: encodeBinding({ value: node.value, params }) }
}
