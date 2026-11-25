import { ArrowUp02Icon, CheckmarkCircle02Icon, Delete02Icon, GitCommitIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import type { GitStatus } from "@/api/types"
import { DiffView } from "@/components/changes/DiffView"
import { Spinner } from "@/components/common/Spinner"
import { EmptyState, LoadingState } from "@/components/common/States"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useDiff, useLog } from "@/hooks/queries"
import type { GitActions } from "@/hooks/useGitActions"
import { relativeTime } from "@/lib/format"

const STATUS_COLOR: Record<string, string> = {
  modified: "text-warning",
  added: "text-success",
  untracked: "text-success",
  deleted: "text-destructive",
  renamed: "text-chart-2",
  conflicted: "text-destructive",
}

export function ChangesPanel({
  repoId,
  status,
  git,
  unsaved,
}: {
  repoId: number
  status: GitStatus | undefined
  git: GitActions
  unsaved: boolean
}) {
  const diff = useDiff(repoId)
  const log = useLog(repoId)
  const [message, setMessage] = useState("Update keymap")
  const files = status?.files ?? []
  const busy = git.commit.isPending || git.push.isPending

  const commit = (push: boolean) => git.commit.mutate({ message, push }, { onSuccess: () => diff.refetch() })

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-r p-4">
        <section className="grid gap-2">
          <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            Working tree · {files.length} file{files.length === 1 ? "" : "s"}
          </div>
          {unsaved && (
            <div className="border-warning/40 bg-warning/10 rounded-lg border px-3 py-2 text-xs">
              You have unsaved edits in the editor. Save them to include them in the commit.
            </div>
          )}
          {files.map((f) => (
            <div key={f.path} className="group flex items-center gap-2 text-sm">
              <span className={`w-16 shrink-0 text-[11px] ${STATUS_COLOR[f.status] ?? ""}`}>{f.status}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs" title={f.path}>
                {f.path}
              </span>
              <button
                title="Discard changes to this file"
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                onClick={() => git.discard.mutate([f.path], { onSuccess: () => diff.refetch() })}
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
              </button>
            </div>
          ))}
        </section>

        {files.length > 0 && (
          <section className="grid gap-2">
            <Textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Commit message"
            />
            <div className="flex gap-2">
              <Button className="flex-1" disabled={busy || !message.trim()} onClick={() => commit(true)}>
                {busy ? <Spinner /> : <HugeiconsIcon icon={ArrowUp02Icon} />} Commit and push
              </Button>
              <Button variant="outline" disabled={busy || !message.trim()} onClick={() => commit(false)}>
                <HugeiconsIcon icon={GitCommitIcon} /> Commit
              </Button>
            </div>
          </section>
        )}

        {status && status.ahead > 0 && (
          <Button variant="secondary" disabled={git.push.isPending} onClick={() => git.push.mutate()}>
            {git.push.isPending ? <Spinner /> : <HugeiconsIcon icon={ArrowUp02Icon} />}
            Push {status.ahead} commit{status.ahead === 1 ? "" : "s"}
          </Button>
        )}

        <section className="grid gap-2">
          <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Recent commits</div>
          {log.data?.map((c, i) => (
            <div key={c.sha} className="grid gap-0.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{c.subject}</span>
                {status && i < status.ahead && <Badge variant="secondary">local</Badge>}
              </div>
              <div className="text-muted-foreground font-mono text-[11px]">
                {c.short} · {c.author} · {relativeTime(c.date)}
              </div>
            </div>
          ))}
        </section>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {diff.isLoading ? (
          <LoadingState />
        ) : files.length === 0 ? (
          <EmptyState icon={CheckmarkCircle02Icon} title="Working tree clean">
            Saved keymap edits show up here as a diff before you commit.
          </EmptyState>
        ) : (
          <DiffView diff={diff.data?.diff ?? ""} />
        )}
      </div>
    </div>
  )
}
