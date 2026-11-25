import type { Layout } from "@/api/types"
import { keyBox, layoutBounds } from "@/lib/layout/geometry"
import type { Legend } from "@/lib/zmk/legend"

// Renders layers as a standalone SVG (and PNG) with the same geometry and
// legends as the editor canvas.

export interface ImageColors {
  background: string
  key: string
  keyEdge: string
  keyMuted: string
  text: string
  muted: string
}

/** Resolves a CSS colour (oklch, var()) to rgb() so other tools can read the SVG. */
function toRgb(css: string): string {
  const c = document.createElement("canvas")
  c.width = c.height = 1
  const ctx = c.getContext("2d")
  if (!ctx) return css
  ctx.fillStyle = "#000"
  ctx.fillStyle = css
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return a === 255 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
}

/** The current theme's colours. */
export function themeColors(): ImageColors {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string) => toRgb(style.getPropertyValue(name).trim() || "#888")
  return {
    background: v("--background"),
    key: v("--key"),
    keyEdge: v("--key-edge"),
    keyMuted: v("--key-muted"),
    text: v("--key-foreground"),
    muted: v("--muted-foreground"),
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const FONT = "ui-sans-serif, system-ui, -apple-system, sans-serif"
const MAIN_SIZE: Record<Legend["size"], number> = { xl: 22, lg: 17, md: 13, sm: 11, xs: 9 }
const PAD = 24
const TITLE = 36

export interface ImageLayer {
  name: string
  legends: Legend[]
}

/** Builds one SVG with every layer stacked vertically under its name. */
export function keymapSvg(
  layout: Layout,
  layers: ImageLayer[],
  colors: ImageColors,
): { svg: string; width: number; height: number } {
  const bounds = layoutBounds(layout.keys)
  const boxes = layout.keys.map((k) => {
    const b = keyBox(k)
    return { ...b, left: b.left - bounds.minX, top: b.top - bounds.minY }
  })
  const blockH = TITLE + bounds.height + PAD
  const width = Math.ceil(bounds.width + PAD * 2)
  const height = Math.ceil(PAD + blockH * layers.length)
  const parts: string[] = []
  layers.forEach((layer, li) => {
    const oy = PAD + li * blockH
    parts.push(
      `<text x="${PAD}" y="${oy + 20}" font-family="${FONT}" font-size="18" font-weight="600" fill="${colors.text}">${esc(layer.name)}</text>`,
    )
    parts.push(`<g transform="translate(${PAD} ${oy + TITLE})">`)
    boxes.forEach((b, i) => {
      const lg = layer.legends[i]
      if (!lg) return
      const quiet = lg.kind === "trans" || lg.kind === "none"
      const rot = b.angle ? ` transform="rotate(${b.angle} ${b.left + b.originX} ${b.top + b.originY})"` : ""
      const cx = b.left + b.width / 2
      const cy = b.top + b.height / 2 - (lg.hold ? 4 : 0)
      parts.push(`<g${rot}>`)
      parts.push(
        `<rect x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" rx="9" fill="${colors.key}" fill-opacity="${quiet ? 0.5 : 1}" stroke="${colors.keyEdge}"/>`,
      )
      if (lg.tag) {
        parts.push(
          `<text x="${b.left + 6}" y="${b.top + 11}" font-family="ui-monospace, monospace" font-size="8" fill="${colors.keyMuted}">${esc(lg.tag)}</text>`,
        )
      }
      const size = MAIN_SIZE[lg.size]
      const lines = wrap(lg.main, b.width - 8, size)
      lines.forEach((line, j) => {
        const y = cy + (j - (lines.length - 1) / 2) * size * 1.1 + size * 0.35
        parts.push(
          `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="500" fill="${quiet ? colors.keyMuted : colors.text}">${esc(line)}</text>`,
        )
      })
      if (lg.color) {
        parts.push(
          `<rect x="${b.left + b.width - 14}" y="${b.top + 6}" width="8" height="8" rx="2" fill="${lg.color}"/>`,
        )
      }
      if (lg.hold) {
        parts.push(
          `<text x="${cx}" y="${b.top + b.height - 6}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="${colors.keyMuted}">${esc(lg.hold)}</text>`,
        )
      }
      parts.push(`</g>`)
    })
    parts.push(`</g>`)
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${colors.background}"/>${parts.join("")}</svg>`
  return { svg, width, height }
}

/** Splits text into at most three lines that roughly fit width. */
function wrap(text: string, width: number, size: number): string[] {
  const perLine = Math.max(3, Math.floor(width / (size * 0.58)))
  if (text.length <= perLine) return [text]
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    if ((cur + " " + w).trim().length > perLine && cur) {
      lines.push(cur)
      cur = w
    } else cur = (cur + " " + w).trim()
  }
  if (cur) lines.push(cur)
  return lines
    .flatMap((l) => (l.length > perLine ? (l.match(new RegExp(`.{1,${perLine}}`, "g")) ?? [l]) : [l]))
    .slice(0, 3)
}

export async function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement("canvas")
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext("2d")!
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
