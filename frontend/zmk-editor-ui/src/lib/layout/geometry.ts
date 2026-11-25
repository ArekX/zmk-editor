import type { LayoutKey } from "@/api/types"

/** Pixel size of 1u and the gap between keys. */
export const UNIT = 56
export const GAP = 6
const STEP = UNIT + GAP

export interface KeyBox {
  left: number
  top: number
  width: number
  height: number
  angle: number
  originX: number
  originY: number
}

export function keyBox(k: LayoutKey): KeyBox {
  const w = k.w || 1
  const h = k.h || 1
  return {
    left: k.x * STEP,
    top: k.y * STEP,
    width: w * UNIT + GAP * (w - 1),
    height: h * UNIT + GAP * (h - 1),
    angle: k.r ?? 0,
    // Rotation origin relative to the key's top-left corner.
    originX: k.rx !== undefined ? (k.rx - k.x) * STEP : 0,
    originY: k.ry !== undefined ? (k.ry - k.y) * STEP : 0,
  }
}

function corners(b: KeyBox): { x: number; y: number }[] {
  const pts = [
    { x: 0, y: 0 },
    { x: b.width, y: 0 },
    { x: b.width, y: b.height },
    { x: 0, y: b.height },
  ]
  const a = (b.angle * Math.PI) / 180
  return pts.map((p) => {
    const dx = p.x - b.originX
    const dy = p.y - b.originY
    return {
      x: b.left + b.originX + dx * Math.cos(a) - dy * Math.sin(a),
      y: b.top + b.originY + dx * Math.sin(a) + dy * Math.cos(a),
    }
  })
}

export interface Bounds {
  minX: number
  minY: number
  width: number
  height: number
}

export function layoutBounds(keys: LayoutKey[]): Bounds {
  if (keys.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const k of keys) {
    for (const p of corners(keyBox(k))) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}
