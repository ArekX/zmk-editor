import { useState } from "react"

import type { GitStatus } from "@/api/types"
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
import type { GitActions } from "@/hooks/useGitActions"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * Commits the saved changes (message prefilled) and pushes, or only pushes
 * when everything is already committed.
 */
export function PushDialog({
  open,
  onOpenChange,
  status,
  git,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: GitStatus
  git: GitActions
}) {
  const [message, setMessage] = useState("Update keymap")
  const files = status.files.length
  const busy = git.commit.isPending || git.push.isPending
  const target = status.upstream || "origin"

  const push = () => {
    const done = { onSuccess: () => onOpenChange(false) }
    if (files > 0) git.commit.mutate({ message, push: true }, done)
    else git.push.mutate(undefined, done)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{files > 0 ? "Commit and push" : "Push"}</DialogTitle>
          <DialogDescription>
            {files > 0
              ? `Commits ${plural(files, "changed file")} on ${status.branch}${status.ahead > 0 ? ` and pushes it with ${plural(status.ahead, "earlier local commit")}` : " and pushes it"} to ${target}.`
              : `Pushes ${plural(status.ahead, "local commit")} on ${status.branch} to ${target}.`}
          </DialogDescription>
        </DialogHeader>
        {files > 0 && (
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Commit message"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && message.trim()) push()
            }}
          />
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={busy || (files > 0 && !message.trim())} onClick={push}>
            {busy && <Spinner />} Push
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
