import { ArrowDown02Icon, GitBranchIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { RemoteCheck } from "@/api/types"
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
import type { GitActions } from "@/hooks/useGitActions"
import { relativeTime } from "@/lib/format"

/** Offers to pull when origin has commits the open branch is missing. */
export function PullPromptDialog({
  check,
  open,
  onOpenChange,
  git,
  dirty,
}: {
  check: RemoteCheck
  open: boolean
  onOpenChange: (open: boolean) => void
  git: GitActions
  dirty: boolean
}) {
  const { status, incoming } = check
  const behind = status.behind
  const diverged = status.ahead > 0
  const changedFiles = status.files.length
  const pull = () => git.pull.mutate(diverged, { onSuccess: () => onOpenChange(false) })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {behind} new commit{behind === 1 ? "" : "s"} on {status.upstream}
          </DialogTitle>
          <DialogDescription>
            Your local <span className="font-mono">{status.branch}</span> branch is behind the remote. Pull before
            editing so your changes build on the latest keymap.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 max-h-64 overflow-y-auto rounded-xl border">
          {incoming.map((c) => (
            <div key={c.sha} className="flex items-start gap-3 border-b px-3 py-2 last:border-b-0">
              <HugeiconsIcon icon={GitBranchIcon} className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{c.subject}</div>
                <div className="text-muted-foreground font-mono text-[11px]">
                  {c.short} · {c.author} · {relativeTime(c.date)}
                </div>
              </div>
            </div>
          ))}
          {behind > incoming.length && (
            <div className="text-muted-foreground px-3 py-2 text-xs">and {behind - incoming.length} more</div>
          )}
        </div>

        {(diverged || changedFiles > 0 || dirty) && (
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
            {diverged && (
              <li>
                You also have {status.ahead} local commit{status.ahead === 1 ? "" : "s"} that are not pushed. Pulling
                rebases them on top of the remote.
              </li>
            )}
            {changedFiles > 0 && (
              <li>
                {changedFiles} file{changedFiles === 1 ? " has" : "s have"} uncommitted changes. They are kept; the pull
                stops if the incoming commits touch the same files.
              </li>
            )}
            {dirty && <li>Save or discard your unsaved edits in the editor first.</li>}
          </ul>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button onClick={pull} disabled={dirty || git.pull.isPending}>
            {git.pull.isPending ? <Spinner /> : <HugeiconsIcon icon={ArrowDown02Icon} />}
            {diverged ? "Pull and rebase" : "Pull"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
