import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/client"
import { endpoints } from "@/api/endpoints"
import type { KeymapDocument } from "@/api/types"
import { Spinner } from "@/components/common/Spinner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { keys } from "@/hooks/queries"

const SOURCE_LABEL: Record<string, string> = {
  custom: "a custom layout saved in this app",
  json: "a layout JSON file in the repository",
  devicetree: "a zmk,physical-layout in the repository",
  zmk: "the keyboard's layout from ZMK itself",
  matrix: "the zmk,matrix-transform map in the repository, arranged as written",
  generated: "a grid generated from the keymap's rows (no layout found)",
}

export function LayoutDialog({
  repoId,
  doc,
  open,
  onOpenChange,
}: {
  repoId: number
  doc: KeymapDocument
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const qc = useQueryClient()
  const [text, setText] = useState("")
  const save = useMutation({
    mutationFn: (layout: unknown) => endpoints.saveLayout(repoId, doc.path, layout),
    onSuccess: (next) => {
      qc.setQueryData(keys.keymap(repoId, doc.path), next)
      onOpenChange(false)
      toast.success("Layout updated")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const apply = () => {
    try {
      save.mutate(JSON.parse(text))
    } catch (e) {
      toast.error(`Invalid JSON: ${errorMessage(e)}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Physical layout</DialogTitle>
          <DialogDescription>
            Using {SOURCE_LABEL[doc.layout.source]}
            {doc.layout.path ? ` (${doc.layout.path})` : ""} with {doc.layout.keys.length} keys.
          </DialogDescription>
        </DialogHeader>
        {doc.layout_warnings.length > 0 && (
          <ul className="text-warning list-disc pl-5 text-xs">
            {doc.layout_warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <div className="grid gap-2">
          <p className="text-muted-foreground text-xs">
            Paste a layout to override it for this keymap: QMK-style info.json (
            <code className="font-mono">{`{"layouts": {"LAYOUT": {"layout": [...]}}}`}</code>), or an array of keys
            with <code className="font-mono">x, y, w, h, r, rx, ry</code> and optional{" "}
            <code className="font-mono">row, col</code>. Row and col also decide how bindings are aligned in the file.
          </p>
          <Textarea
            rows={12}
            className="font-mono text-xs"
            placeholder={JSON.stringify(doc.layout.keys.slice(0, 2))}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <DialogFooter>
          {doc.layout.source === "custom" && (
            <Button variant="ghost" onClick={() => save.mutate(null)} disabled={save.isPending}>
              Remove custom layout
            </Button>
          )}
          <Button variant="outline" onClick={() => setText(JSON.stringify(doc.layout.keys, null, 1))}>
            Load current
          </Button>
          <Button onClick={apply} disabled={!text.trim() || save.isPending}>
            {save.isPending && <Spinner />} Save layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
