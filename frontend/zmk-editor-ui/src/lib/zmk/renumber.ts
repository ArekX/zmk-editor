import type { Keymap } from "@/api/types"
import { encodeBinding, parseBinding, resolveNumber } from "@/lib/zmk/bindings"
import { paramsFor, type Catalog } from "@/lib/zmk/catalog"

/** Maps an old layer index to its new one, or null when it was deleted. */
export type LayerMapping = (old: number) => number | null

/** Calls fn for every binding string in the keymap, replacing it. */
export function mapAllBindings(km: Keymap, fn: (binding: string) => string): Keymap {
  return {
    ...km,
    layers: km.layers.map((l) => ({
      ...l,
      bindings: l.bindings.map(fn),
      sensor_bindings: l.sensor_bindings ? l.sensor_bindings.map(fn) : null,
    })),
    combos: km.combos.map((c) => (c.read_only ? c : { ...c, binding: fn(c.binding) })),
    behaviors: km.behaviors.map((b) => ({ ...b, bindings: b.bindings.map(fn) })),
  }
}

/**
 * Rewrites every layer reference after layers moved: layer parameters of
 * bindings (&mo 2, &lt 1 SPACE, custom hold-taps on &mo), combo layer
 * lists, conditional layers, and #defines used as layer names. References
 * to a deleted layer are left as they are.
 */
export function renumberLayers(km: Keymap, mapping: LayerMapping, catalog: Catalog): Keymap {
  const defines = { ...km.defines }
  const definesDone = new Set<string>()
  const remap = (n: number) => mapping(n) ?? n

  const fixParam = (value: string): string => {
    const t = value.trim()
    if (/^\d+$/.test(t)) return String(remap(Number(t)))
    // A define naming a layer (`#define NAV 2`): update the define once.
    if (t in km.defines && !definesDone.has(t)) {
      const v = resolveNumber(t, km.defines)
      definesDone.add(t)
      if (v !== null && /^\(?\s*\d+\s*\)?$/.test(km.defines[t].trim())) defines[t] = String(remap(v))
    }
    return value
  }

  const fixBinding = (binding: string): string => {
    const node = parseBinding(binding)
    const def = catalog.behavior.get(node.value)
    if (!def) return binding
    const specs = paramsFor(def, node)
    let changed = false
    const params = node.params.map((p, i) => {
      if (specs[i]?.kind !== "layer" || p.params.length > 0) return p
      const next = fixParam(p.value)
      if (next !== p.value) changed = true
      return { ...p, value: next }
    })
    return changed ? encodeBinding({ value: node.value, params }) : binding
  }

  const listed = (layers: number[]) => layers.map(remap)
  const next = mapAllBindings(km, fixBinding)
  return {
    ...next,
    combos: next.combos.map((c) => (c.read_only ? c : { ...c, layers: listed(c.layers) })),
    conditional_layers: km.conditional_layers.map((c) =>
      c.read_only ? c : { ...c, if_layers: listed(c.if_layers), then_layer: remap(c.then_layer) },
    ),
    defines,
  }
}

/** Number of places that refer to layer index `layer`. */
export function countLayerRefs(km: Keymap, layer: number, catalog: Catalog): number {
  let count = 0
  const check = (binding: string) => {
    const node = parseBinding(binding)
    const specs = paramsFor(catalog.behavior.get(node.value), node)
    node.params.forEach((p, i) => {
      if (specs[i]?.kind === "layer" && resolveNumber(p.value, km.defines) === layer) count++
    })
    return binding
  }
  mapAllBindings(km, check)
  for (const c of km.combos) if (c.layers.includes(layer)) count++
  for (const c of km.conditional_layers) if (c.if_layers.includes(layer) || c.then_layer === layer) count++
  return count
}

/** Mapping for moving the layer at `from` to index `to`. */
export function moveMapping(from: number, to: number): LayerMapping {
  return (i) => {
    if (i === from) return to
    if (from < to && i > from && i <= to) return i - 1
    if (to < from && i >= to && i < from) return i + 1
    return i
  }
}

/** Mapping for deleting the layer at `index`. */
export function deleteMapping(index: number): LayerMapping {
  return (i) => (i === index ? null : i > index ? i - 1 : i)
}
