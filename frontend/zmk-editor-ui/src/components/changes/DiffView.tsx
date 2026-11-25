import { useMemo } from "react"

import { cn } from "@/lib/utils"

interface DiffFile {
  path: string
  lines: { kind: "add" | "del" | "ctx" | "hunk"; text: string }[]
}

function parseDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = []
  let cur: DiffFile | null = null
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      const m = line.match(/ b\/(.+)$/)
      cur = { path: m?.[1] ?? line, lines: [] }
      files.push(cur)
      continue
    }
    if (!cur) continue
    if (/^(index |--- |\+\+\+ |new file|deleted file|similarity|rename |old mode|new mode)/.test(line)) continue
    if (line.startsWith("@@")) cur.lines.push({ kind: "hunk", text: line })
    else if (line.startsWith("+")) cur.lines.push({ kind: "add", text: line.slice(1) })
    else if (line.startsWith("-")) cur.lines.push({ kind: "del", text: line.slice(1) })
    else if (line.startsWith(" ")) cur.lines.push({ kind: "ctx", text: line.slice(1) })
  }
  return files
}

export function DiffView({ diff }: { diff: string }) {
  const files = useMemo(() => parseDiff(diff), [diff])
  if (files.length === 0) return <div className="text-muted-foreground p-6 text-sm">No changes.</div>
  return (
    <div className="grid gap-4">
      {files.map((f) => (
        <div key={f.path} className="bg-card overflow-hidden rounded-xl border">
          <div className="bg-muted/40 border-b px-4 py-2 font-mono text-xs">{f.path}</div>
          <div className="overflow-x-auto font-mono text-[12px] leading-5">
            {f.lines.map((l, i) => (
              <div
                key={i}
                className={cn(
                  "px-4 whitespace-pre",
                  l.kind === "add" && "diff-add",
                  l.kind === "del" && "diff-del",
                  l.kind === "hunk" && "diff-hunk",
                )}
              >
                <span className="text-muted-foreground mr-3 inline-block w-3 select-none">
                  {l.kind === "add" ? "+" : l.kind === "del" ? "-" : ""}
                </span>
                {l.text || " "}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
