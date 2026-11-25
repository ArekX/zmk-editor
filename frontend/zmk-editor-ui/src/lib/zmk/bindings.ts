// Binding strings ("&kp LC(LS(A))") <-> trees. Parameters can be nested
// function-style values: LC(A), RGB_COLOR_HSB(0,80,60).

export interface BindNode {
  value: string
  params: BindNode[]
}

/** Splits on separator at parenthesis depth 0. */
function splitTopLevel(s: string, separator: (c: string) => boolean): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ""
  for (const c of s) {
    if (c === "(") depth++
    if (c === ")") depth = Math.max(0, depth - 1)
    if (depth === 0 && separator(c)) {
      if (cur.trim()) out.push(cur.trim())
      cur = ""
      continue
    }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export function parseParam(s: string): BindNode {
  const open = s.indexOf("(")
  if (open < 0 || !s.endsWith(")")) return { value: s, params: [] }
  const inner = s.slice(open + 1, -1)
  return {
    value: s.slice(0, open),
    params: splitTopLevel(inner, (c) => c === ",").map(parseParam),
  }
}

export function parseBinding(binding: string): BindNode {
  const parts = splitTopLevel(binding.trim(), (c) => /\s/.test(c))
  const [value = "&none", ...params] = parts
  return { value, params: params.map(parseParam) }
}

export function encodeParam(node: BindNode): string {
  if (node.params.length === 0) return node.value
  return `${node.value}(${node.params.map(encodeParam).join(",")})`
}

export function encodeBinding(node: BindNode): string {
  return [node.value, ...node.params.map(encodeParam)].join(" ").trim()
}

/** Expands object-like macros (e.g. `___` -> `&trans`) for display. */
export function expandDefines(binding: string, defines: Record<string, string>): string {
  let cur = binding.trim()
  for (let i = 0; i < 8; i++) {
    const [head, ...rest] = cur.split(/\s+/)
    const def = defines[head]
    if (def === undefined) return cur
    cur = [def.trim(), ...rest].join(" ")
  }
  return cur
}

/** Resolves a cell to a number through defines (e.g. NAV -> 1). */
export function resolveNumber(cell: string, defines: Record<string, string>): number | null {
  let cur = cell.trim()
  for (let i = 0; i < 8; i++) {
    const unwrapped = cur.replace(/^\((.*)\)$/, "$1").trim()
    if (/^-?\d+$/.test(unwrapped)) return Number(unwrapped)
    if (/^0x[0-9a-f]+$/i.test(unwrapped)) return parseInt(unwrapped, 16)
    const def = defines[unwrapped]
    if (def === undefined) return null
    cur = def
  }
  return null
}
