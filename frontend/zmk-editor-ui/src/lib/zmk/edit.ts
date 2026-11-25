import type { Combo, Keymap, Layer } from "@/api/types"
import type { Catalog } from "@/lib/zmk/catalog"
import { behaviorUses, deleteBehavior } from "@/lib/zmk/behaviorEdit"
import { deleteMapping, moveMapping, renumberLayers } from "@/lib/zmk/renumber"

// Immutable keymap edits used by the editor.

export function setBinding(km: Keymap, layer: number, key: number, binding: string): Keymap {
  const layers = km.layers.map((l, i) => {
    if (i !== layer) return l
    const bindings = [...l.bindings]
    bindings[key] = binding
    return { ...l, bindings }
  })
  return { ...km, layers }
}

export function setSensorBinding(km: Keymap, layer: number, index: number, binding: string, count: number): Keymap {
  const layers = km.layers.map((l, i) => {
    if (i !== layer) return l
    const current = l.sensor_bindings ?? []
    const next = Array.from({ length: Math.max(count, current.length) }, (_, j) => current[j] ?? "&trans")
    next[index] = binding
    return { ...l, sensor_bindings: next }
  })
  return { ...km, layers }
}

export function clearSensorBindings(km: Keymap, layer: number): Keymap {
  return { ...km, layers: km.layers.map((l, i) => (i === layer ? { ...l, sensor_bindings: null } : l)) }
}

export function addLayer(km: Keymap, name: string, keyCount: number): Keymap {
  const layer: Layer = {
    id: "",
    name,
    bindings: Array.from({ length: keyCount }, () => "&trans"),
    sensor_bindings: null,
  }
  return { ...km, layers: [...km.layers, layer] }
}

export function renameLayer(km: Keymap, index: number, name: string): Keymap {
  return { ...km, layers: km.layers.map((l, i) => (i === index ? { ...l, name } : l)) }
}

/** Deletes a layer and renumbers references to the layers after it. */
export function deleteLayer(km: Keymap, index: number, catalog: Catalog): Keymap {
  const renumbered = renumberLayers(km, deleteMapping(index), catalog)
  return { ...renumbered, layers: renumbered.layers.filter((_, i) => i !== index) }
}

/** Moves a layer and renumbers every reference to the layers it passes. */
export function moveLayer(km: Keymap, from: number, to: number, catalog: Catalog): Keymap {
  if (from === to || to < 0 || to >= km.layers.length) return km
  const renumbered = renumberLayers(km, moveMapping(from, to), catalog)
  const layers = [...renumbered.layers]
  const [moved] = layers.splice(from, 1)
  layers.splice(to, 0, moved)
  return { ...renumbered, layers }
}

export interface KeyRef {
  layer: number
  key: number
}

/** Swaps two key bindings, possibly on different layers. */
export function swapBindings(km: Keymap, a: KeyRef, b: KeyRef): Keymap {
  const ba = km.layers[a.layer]?.bindings[a.key]
  const bb = km.layers[b.layer]?.bindings[b.key]
  if (ba === undefined || bb === undefined || (a.layer === b.layer && a.key === b.key)) return km
  return setBinding(setBinding(km, a.layer, a.key, bb), b.layer, b.key, ba)
}

/** Sets bindings of several keys on one layer: keys[i] gets values[i], or values[0] for all. */
export function setBindings(km: Keymap, layer: number, keys: number[], values: string[]): Keymap {
  const layers = km.layers.map((l, i) => {
    if (i !== layer) return l
    const bindings = [...l.bindings]
    keys.forEach((k, j) => {
      if (k >= 0 && k < bindings.length) bindings[k] = values.length === 1 ? values[0] : (values[j] ?? bindings[k])
    })
    return { ...l, bindings }
  })
  return { ...km, layers }
}

export function duplicateLayer(km: Keymap, index: number): Keymap {
  const src = km.layers[index]
  const copy: Layer = { ...src, id: "", name: `${src.name} copy`, bindings: [...src.bindings] }
  return { ...km, layers: [...km.layers, copy] }
}

export function updateCombo(km: Keymap, index: number, patch: Partial<Combo>): Keymap {
  return { ...km, combos: km.combos.map((c, i) => (i === index ? { ...c, ...patch } : c)) }
}

export function addCombo(km: Keymap): Keymap {
  const names = new Set(km.combos.map((c) => c.name))
  let n = km.combos.length + 1
  while (names.has(`combo_${n}`)) n++
  const combo: Combo = {
    id: "",
    name: `combo_${n}`,
    key_positions: [],
    binding: "&kp ESC",
    layers: [],
    timeout_ms: null,
    require_prior_idle_ms: null,
    slow_release: false,
    read_only: false,
  }
  return { ...km, combos: [...km.combos, combo] }
}

export function deleteCombo(km: Keymap, index: number): Keymap {
  return { ...km, combos: km.combos.filter((_, i) => i !== index) }
}

/**
 * Reverts keys on one layer to the bindings they had when the keymap was
 * loaded (layers matched by node name). A key that was swapped with
 * another key, on any layer, brings its partner back too; macros created
 * in this session that end up unused are removed.
 */
export function revertKeys(km: Keymap, original: Keymap, layer: number, keys: number[]): Keymap {
  const origOf = (i: number) => {
    const id = km.layers[i]?.id
    return id ? original.layers.find((l) => l.id === id) : undefined
  }
  const orig = origOf(layer)
  if (!orig) return km
  let next = km
  const dropped: string[] = []
  for (const k of keys) {
    const cur = next.layers[layer].bindings[k]
    const want = orig.bindings[k]
    if (cur === undefined || want === undefined || cur === want) continue
    next = setBinding(next, layer, k, want)
    dropped.push(cur)
    // The swap partner holds this key's binding and had the one we drop.
    partner: for (let li = 0; li < next.layers.length; li++) {
      const o = origOf(li)
      if (!o) continue
      const bindings = next.layers[li].bindings
      for (let p = 0; p < bindings.length; p++) {
        if ((li === layer && p === k) || bindings[p] !== want || o.bindings[p] !== cur) continue
        next = setBinding(next, li, p, cur)
        break partner
      }
    }
  }
  // New macros (not yet in the file) that nothing uses any more.
  for (const b of dropped) {
    const label = b.trim().split(/\s+/)[0]?.replace(/^&/, "")
    const i = next.behaviors.findIndex((x) => x.label === label && !x.id && x.kind === "macro")
    if (i >= 0 && behaviorUses(next, label).length === 0) next = deleteBehavior(next, i)
  }
  return next
}
