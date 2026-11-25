import type { Combo, Keymap, Layer } from "@/api/types"

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

export function deleteLayer(km: Keymap, index: number): Keymap {
  return { ...km, layers: km.layers.filter((_, i) => i !== index) }
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
