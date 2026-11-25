import type { BehaviorCommand, BuiltinBehavior, CustomBehavior, Keymap } from "@/api/types"
import { parseBinding, type BindNode } from "@/lib/zmk/bindings"
import type { Keycode } from "@/lib/zmk/keycodes"
import { paramFromName, type ParamSpec } from "@/lib/zmk/params"

export interface BehaviorDef {
  code: string
  name: string
  description: string
  params: ParamSpec[]
  commands?: BehaviorCommand[]
  custom?: CustomBehavior
  holdTap: boolean
  sensor: boolean
  /** Macro control behaviors, offered only inside macros. */
  macro: boolean
}

export interface LayerRef {
  index: number
  name: string
}

/** Everything needed to render and edit bindings of one keymap. */
export interface Catalog {
  behaviors: BehaviorDef[]
  behavior: Map<string, BehaviorDef>
  keycodes: Keycode[]
  keycode: Map<string, Keycode>
  layers: LayerRef[]
  defines: Record<string, string>
}

const HOLD_TAP_BUILTINS = new Set(["&mt", "&lt"])

function builtinDef(b: BuiltinBehavior): BehaviorDef {
  return {
    code: b.code,
    name: b.name,
    description: b.description,
    params: b.params.map((p, i) => {
      const spec = paramFromName(p, b.code)
      if (HOLD_TAP_BUILTINS.has(b.code)) spec.name = i === 0 ? "hold" : "tap"
      return spec
    }),
    commands: b.commands,
    holdTap: HOLD_TAP_BUILTINS.has(b.code),
    sensor: !!b.sensor,
    macro: !!b.macro,
  }
}

/** The spec of the first parameter of the behavior a binding refers to. */
function specOf(binding: string | undefined, defs: Map<string, BehaviorDef>, name: string): ParamSpec {
  const ref = binding ? parseBinding(binding).value : ""
  const def = defs.get(ref)
  const first = def?.params[0]
  if (first) return { ...first, name }
  return { kind: "code", name }
}

/**
 * What each parameter of a parameterized macro feeds: `&macro_param_1to2`
 * followed by `&mt ...` means parameter 1 is the second parameter of &mt.
 */
function macroParamSpecs(c: CustomBehavior, defs: Map<string, BehaviorDef>): ParamSpec[] {
  const specs: ParamSpec[] = Array.from({ length: c.binding_cells }, (_, i) => ({
    kind: "code" as const,
    name: c.binding_cells > 1 ? `param ${i + 1}` : undefined,
  }))
  let pending: [number, number][] = []
  for (const step of c.bindings) {
    const m = /^&macro_param_(\d)to(\d)$/.exec(step.trim())
    if (m) {
      pending.push([Number(m[1]) - 1, Number(m[2]) - 1])
      continue
    }
    const node = parseBinding(step)
    const target = defs.get(node.value)?.params
    for (const [from, to] of pending) {
      const spec = target?.[to]
      if (spec && specs[from]) specs[from] = { ...spec, name: specs[from].name }
    }
    pending = []
  }
  return specs
}

function customDef(c: CustomBehavior, builtins: Map<string, BehaviorDef>): BehaviorDef {
  const title = humanize(c.display_name) || c.node_name || c.label
  const def: BehaviorDef = {
    code: `&${c.label}`,
    name: title,
    description: `${c.kind} defined in this keymap (${c.compatible})`,
    params: [],
    custom: c,
    holdTap: c.kind === "hold-tap",
    sensor: c.kind === "sensor",
    macro: false,
  }
  if (c.kind === "hold-tap" && c.binding_cells === 2) {
    def.params = [specOf(c.bindings[0], builtins, "hold"), specOf(c.bindings[1], builtins, "tap")]
  } else if (c.kind === "sensor") {
    const n = c.sensor_binding_cells ?? 0
    const names = ["clockwise", "counter-clockwise"]
    def.params = Array.from({ length: n }, (_, i) =>
      specOf(c.bindings[i] ?? c.bindings[0], builtins, names[i] ?? `param ${i + 1}`),
    )
  } else if (c.kind === "sticky-key" && c.binding_cells === 1) {
    def.params = [specOf(c.bindings[0], builtins, "key")]
  } else if (c.kind === "macro") {
    def.params = macroParamSpecs(c, builtins)
  } else {
    def.params = Array.from({ length: c.binding_cells }, (_, i) => ({
      kind: "code" as const,
      name: c.binding_cells > 1 ? `param ${i + 1}` : undefined,
    }))
  }
  return def
}

function humanize(s: string): string {
  if (!s) return ""
  if (/^[A-Z0-9_]+$/.test(s)) {
    return s
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase())
  }
  return s
}

export function buildCatalog(builtin: BuiltinBehavior[], keycodes: Keycode[], keymap: Keymap): Catalog {
  const behavior = new Map<string, BehaviorDef>()
  for (const b of builtin) behavior.set(b.code, builtinDef(b))
  const builtins = new Map(behavior)
  for (const c of keymap.behaviors) behavior.set(`&${c.label}`, customDef(c, builtins))
  const keycode = new Map<string, Keycode>()
  for (const k of keycodes) if (!keycode.has(k.code)) keycode.set(k.code, k)
  return {
    behaviors: [...behavior.values()],
    behavior,
    keycodes,
    keycode,
    layers: keymap.layers.map((l, index) => ({ index, name: l.name })),
    defines: keymap.defines,
  }
}

/** Parameters of a behavior, including a command's additional parameters. */
export function paramsFor(def: BehaviorDef | undefined, node: BindNode): ParamSpec[] {
  if (!def) return node.params.map(() => ({ kind: "raw" as const }))
  const params = [...def.params]
  if (def.params[0]?.kind === "command" && def.commands) {
    const cmd = def.commands.find((c) => c.code === node.params[0]?.value)
    for (const extra of cmd?.additionalParams ?? []) {
      params.push({ kind: extra.enum ? "enum" : "raw", name: extra.name, values: extra.enum })
    }
  }
  return params
}
