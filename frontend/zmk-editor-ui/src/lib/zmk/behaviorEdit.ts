import type { BehaviorKind, ConditionalLayer, CustomBehavior, Keymap, Override, Prop } from "@/api/types"
import { encodeBinding, parseBinding } from "@/lib/zmk/bindings"
import { macroCompatible, schemaFor, SCHEMAS, type FieldType } from "@/lib/zmk/behaviorSchemas"
import { mapAllBindings } from "@/lib/zmk/renumber"

// Immutable edits of custom behaviors, overrides and conditional layers.

export const LABEL_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

export function getProp(props: Prop[], name: string): Prop | undefined {
  return props.find((p) => p.name === name)
}

/** Sets (value !== null) or removes (null) a property, keeping order. */
export function setProp(props: Prop[], name: string, value: Omit<Prop, "name"> | null): Prop[] {
  const i = props.findIndex((p) => p.name === name)
  if (value === null) return i < 0 ? props : props.filter((_, j) => j !== i)
  const next = { name, ...value }
  if (i < 0) return [...props, next]
  return props.map((p, j) => (j === i ? next : p))
}

/** The value a form field shows for a property. */
export function fieldValue(props: Prop[], name: string, type: FieldType): string | boolean {
  const p = getProp(props, name)
  if (type === "bool") return !!p
  return p?.value ?? ""
}

/** Converts a form field value back into a property (null removes it). */
export function fieldProp(type: FieldType, value: string | boolean): Omit<Prop, "name"> | null {
  if (type === "bool") return value ? { type: "bool", value: "" } : null
  const v = String(value).trim()
  if (v === "") return null
  if (type === "enum") return { type: "string", value: v }
  return { type: "cells", value: v }
}

/** Parses `(MOD_LSFT|MOD_RSFT)` into its flags. */
export function parseMods(value: string): string[] {
  return value
    .replace(/[()]/g, "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
}

export function formatMods(flags: string[]): string {
  if (flags.length === 0) return ""
  return flags.length === 1 ? flags[0] : `(${flags.join("|")})`
}

/** Every label in use: custom behaviors plus built-ins. */
export function takenLabels(km: Keymap, builtinCodes: string[], except?: number): Set<string> {
  const out = new Set(builtinCodes.map((c) => c.replace(/^&/, "")))
  km.behaviors.forEach((b, i) => {
    if (i !== except) out.add(b.label)
  })
  return out
}

export function uniqueLabel(base: string, taken: Set<string>): string {
  let label = base.replace(/[^A-Za-z0-9_]/g, "_").replace(/^(\d)/, "_$1") || "behavior"
  if (!taken.has(label)) return label
  for (let n = 2; ; n++) {
    if (!taken.has(`${label}_${n}`)) return `${label}_${n}`
  }
}

export function newBehavior(kind: BehaviorKind, label: string): CustomBehavior {
  const schema = SCHEMAS.find((s) => s.kind === kind)!
  return {
    id: "",
    label,
    ref: `&${label}`,
    node_name: "",
    compatible: schema.compatible,
    kind,
    display_name: "",
    binding_cells: schema.bindingCells,
    sensor_binding_cells: null,
    bindings: [...schema.initial.bindings],
    props: schema.initial.props.map((p) => ({ ...p })),
    source: "",
  }
}

export function addBehavior(km: Keymap, b: CustomBehavior): Keymap {
  return { ...km, behaviors: [...km.behaviors, b] }
}

export function updateBehavior(km: Keymap, index: number, patch: Partial<CustomBehavior>): Keymap {
  return { ...km, behaviors: km.behaviors.map((b, i) => (i === index ? normalize({ ...b, ...patch }) : b)) }
}

/** Keeps a macro's compatible and #binding-cells in line with its parameters. */
function normalize(b: CustomBehavior): CustomBehavior {
  if (b.kind !== "macro") return b
  const { compatible, cells } = macroCompatible(macroParamCount(b.bindings))
  return compatible === b.compatible && cells === b.binding_cells ? b : { ...b, compatible, binding_cells: cells }
}

/** How many macro parameters (0-2) a macro's steps use. */
export function macroParamCount(steps: string[]): number {
  let max = 0
  for (const s of steps) {
    const m = /^&macro_param_(\d)to\d$/.exec(s.trim())
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

function refOf(binding: string): string {
  return parseBinding(binding).value
}

/** Renames a behavior and every binding that refers to it. */
export function renameBehavior(km: Keymap, index: number, label: string): Keymap {
  const old = `&${km.behaviors[index].label}`
  const next = `&${label}`
  const renamed = mapAllBindings(km, (b) => {
    const node = parseBinding(b)
    return node.value === old ? encodeBinding({ ...node, value: next }) : b
  })
  return {
    ...renamed,
    behaviors: renamed.behaviors.map((b, i) => (i === index ? { ...b, label } : b)),
  }
}

/** Where a behavior is used, as readable places ("layer Base key 3"). */
export function behaviorUses(km: Keymap, label: string): string[] {
  const ref = `&${label}`
  const out: string[] = []
  km.layers.forEach((l) => {
    l.bindings.forEach((b, k) => refOf(b) === ref && out.push(`${l.name} key ${k}`))
    l.sensor_bindings?.forEach((b, k) => refOf(b) === ref && out.push(`${l.name} encoder ${k}`))
  })
  km.combos.forEach((c) => refOf(c.binding) === ref && out.push(`combo ${c.name}`))
  km.behaviors.forEach((b) => {
    if (b.label !== label && b.bindings.some((x) => refOf(x) === ref)) out.push(`&${b.label}`)
  })
  return out
}

export function deleteBehavior(km: Keymap, index: number): Keymap {
  return { ...km, behaviors: km.behaviors.filter((_, i) => i !== index) }
}

export function setOverride(km: Keymap, ref: string, props: Prop[] | null): Keymap {
  const i = km.overrides.findIndex((o) => o.ref === ref)
  if (props === null) return { ...km, overrides: km.overrides.filter((o) => o.ref !== ref) }
  if (i < 0) {
    const o: Override = { id: "", ref, props }
    return { ...km, overrides: [...km.overrides, o] }
  }
  return { ...km, overrides: km.overrides.map((o, j) => (j === i ? { ...o, props } : o)) }
}

export function addConditional(km: Keymap): Keymap {
  const names = new Set(km.conditional_layers.map((c) => c.name))
  let n = km.conditional_layers.length + 1
  while (names.has(`conditional_${n}`)) n++
  const c: ConditionalLayer = {
    id: "",
    name: `conditional_${n}`,
    if_layers: km.layers.length > 2 ? [1, 2] : [0],
    then_layer: Math.max(0, km.layers.length - 1),
    read_only: false,
  }
  return { ...km, conditional_layers: [...km.conditional_layers, c] }
}

export function updateConditional(km: Keymap, index: number, patch: Partial<ConditionalLayer>): Keymap {
  return { ...km, conditional_layers: km.conditional_layers.map((c, i) => (i === index ? { ...c, ...patch } : c)) }
}

export function deleteConditional(km: Keymap, index: number): Keymap {
  return { ...km, conditional_layers: km.conditional_layers.filter((_, i) => i !== index) }
}

// Macro steps are edited as items: a binding plus the &macro_param_XtoY
// steps in front of it.

export interface MacroItem {
  /** [from, to] parameter mappings, 1-based as in &macro_param_1to2. */
  params: [number, number][]
  binding: string
}

export function macroItems(steps: string[]): MacroItem[] {
  const items: MacroItem[] = []
  let params: [number, number][] = []
  for (const s of steps) {
    const m = /^&macro_param_(\d)to(\d)$/.exec(s.trim())
    if (m) {
      params.push([Number(m[1]), Number(m[2])])
      continue
    }
    items.push({ params, binding: s })
    params = []
  }
  if (params.length) items.push({ params, binding: "" })
  return items
}

export function macroSteps(items: MacroItem[]): string[] {
  return items.flatMap((it) => [
    ...it.params.map(([f, t]) => `&macro_param_${f}to${t}`),
    ...(it.binding ? [it.binding] : []),
  ])
}

/** Problems with how a macro passes its parameters on. */
export function macroWarnings(items: MacroItem[]): string[] {
  const out: string[] = []
  items.forEach((it, i) => {
    const node = parseBinding(it.binding || "&none")
    for (const [, to] of it.params) {
      if (!node.params[to - 1])
        out.push(`Step ${i + 1}: ${node.value} has no parameter ${to} to receive a macro parameter.`)
    }
    node.params.forEach((p, j) => {
      if (p.value === "MACRO_PLACEHOLDER" && !it.params.some(([, to]) => to === j + 1)) {
        out.push(`Step ${i + 1}: parameter ${j + 1} is a placeholder but no macro parameter is passed to it.`)
      }
    })
  })
  return out
}

export { schemaFor }

/**
 * A macro that presses keys together and holds them while its own key is
 * held: `&macro_press &kp LCTRL &kp A &kp S`, pause for release, then
 * release them. Reuses an identical macro already in the keymap.
 */
export function addChordMacro(km: Keymap, keys: string[], builtinCodes: string[]): { keymap: Keymap; label: string } {
  const press = keys.map((k) => `&kp ${k}`)
  const bindings = ["&macro_press", ...press, "&macro_pause_for_release", "&macro_release", ...press]
  const same = km.behaviors.find(
    (b) =>
      b.kind === "macro" &&
      b.bindings.length === bindings.length &&
      b.bindings.every((x, i) => x.trim() === bindings[i]),
  )
  if (same) return { keymap: km, label: same.label }
  const base = `chord_${keys.map((k) => k.toLowerCase()).join("_")}`
  const label = uniqueLabel(base, takenLabels(km, builtinCodes))
  const macro: CustomBehavior = {
    ...newBehavior("macro", label),
    display_name: keys.join(" + "),
    bindings,
    props: [],
  }
  return { keymap: addBehavior(km, macro), label }
}
