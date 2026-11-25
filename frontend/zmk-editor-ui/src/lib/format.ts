export function relativeTime(iso: string | undefined | null): string {
  if (!iso) return ""
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  const abs = Math.abs(diff)
  const units: [number, string][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ]
  let value = abs
  for (const [step, unit] of units) {
    if (value < step) {
      const n = Math.max(1, Math.floor(value))
      if (unit === "second") return "just now"
      return `${n} ${unit}${n === 1 ? "" : "s"} ago`
    }
    value /= step
  }
  return ""
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function basename(path: string): string {
  return path.split("/").pop() ?? path
}
