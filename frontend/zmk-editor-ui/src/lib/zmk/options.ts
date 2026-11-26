import type { PickerOption } from "@/components/common/ValuePicker"
import type { BehaviorDef, Catalog } from "@/lib/zmk/catalog"
import type { ParamSpec } from "@/lib/zmk/params"
import { shortestName } from "@/lib/zmk/keycodes"

const SYSTEM = new Set([
  "&bt",
  "&out",
  "&rgb_ug",
  "&bl",
  "&ext_power",
  "&sys_reset",
  "&bootloader",
  "&soft_off",
  "&studio_unlock",
])
const MOUSE = new Set(["&mkp", "&mmv", "&msc"])

function behaviorGroup(b: BehaviorDef): string {
  if (b.custom) return "Defined in this keymap"
  if (b.macro) return "Macro steps"
  if (SYSTEM.has(b.code)) return "System"
  if (MOUSE.has(b.code)) return "Mouse"
  return "Keys and layers"
}

export function behaviorOptions(catalog: Catalog, sensor: boolean, macro = false): PickerOption[] {
  return catalog.behaviors
    .filter((b) => (sensor ? b.sensor : !b.sensor) && (macro || !b.macro))
    .map((b) => ({
      value: b.code,
      label: b.code,
      hint: b.name,
      group: behaviorGroup(b),
      keywords: [b.description],
    }))
}

let keycodeCache: { catalog: Catalog; mods: boolean; options: PickerOption[] } | null = null

export function keycodeOptions(catalog: Catalog, modsOnly: boolean): PickerOption[] {
  if (keycodeCache?.catalog === catalog && keycodeCache.mods === modsOnly) return keycodeCache.options
  const seen = new Set<string>()
  const options: PickerOption[] = []
  for (const k of catalog.keycodes) {
    if (k.isModifierFn) continue
    if (modsOnly && !k.isModifier) continue
    const primary = shortestName(k.aliases)
    if (seen.has(primary)) continue
    seen.add(primary)
    options.push({
      value: primary,
      label: primary,
      hint: k.description,
      symbol: k.symbol.length <= 4 ? k.symbol : undefined,
      group: k.context,
      keywords: k.aliases,
    })
  }
  keycodeCache = { catalog, mods: modsOnly, options }
  return options
}

export function layerOptions(catalog: Catalog): PickerOption[] {
  return catalog.layers.map((l) => ({
    value: String(l.index),
    label: String(l.index),
    hint: l.name,
    keywords: [l.name],
  }))
}

export function optionsFor(spec: ParamSpec, catalog: Catalog): PickerOption[] {
  switch (spec.kind) {
    case "code":
      return keycodeOptions(catalog, false)
    case "mod":
      return keycodeOptions(catalog, true)
    case "layer":
      return layerOptions(catalog)
    case "command": {
      const def = spec.behavior ? catalog.behavior.get(spec.behavior) : undefined
      return (def?.commands ?? []).map((c) => ({ value: c.code, label: c.code, hint: c.description }))
    }
    case "enum":
      return (spec.values ?? []).map((v) => ({ value: String(v), label: String(v) }))
    default:
      return []
  }
}

export function defaultValue(spec: ParamSpec, catalog: Catalog): string {
  switch (spec.kind) {
    case "code":
      return "A"
    case "mod":
      return "LSHIFT"
    case "layer":
      return catalog.layers.length > 1 ? "1" : "0"
    case "command": {
      const def = spec.behavior ? catalog.behavior.get(spec.behavior) : undefined
      return def?.commands?.[0]?.code ?? "0"
    }
    case "enum":
      return String(spec.values?.[0] ?? 0)
    default:
      return "0"
  }
}
