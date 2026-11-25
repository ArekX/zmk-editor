import { ArrowUpRight01Icon, PlayIcon, Refresh01Icon, UsbIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { ApiError, errorMessage } from "@/api/client"
import { endpoints } from "@/api/endpoints"
import type { BuildRun, Repository } from "@/api/types"
import { Spinner } from "@/components/common/Spinner"
import { ErrorState, LoadingState } from "@/components/common/States"
import { ArtifactRow } from "@/components/firmware/ArtifactRow"
import { RunStatusIcon } from "@/components/firmware/RunStatusIcon"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { keys, useArtifacts, useBuilds, useDevices, useFirmware } from "@/hooks/queries"
import { relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

function RunItem({ repoId, run, expanded, onToggle }: { repoId: number; run: BuildRun; expanded: boolean; onToggle: () => void }) {
  const artifacts = useArtifacts(repoId, run.id, expanded && run.status === "completed")
  const firmware = useFirmware(repoId, expanded)
  const devices = useDevices(expanded)
  return (
    <div className={cn("rounded-xl border transition-colors", expanded && "bg-muted/30")}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <RunStatusIcon run={run} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{run.display_title || run.name}</div>
          <div className="text-muted-foreground font-mono text-[11px]">
            #{run.run_number} · {run.head_branch} · {run.head_sha.slice(0, 7)} · {relativeTime(run.created_at)}
          </div>
        </div>
        <a
          href={run.html_url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground"
          title="Open on GitHub"
        >
          <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" />
        </a>
      </button>
      {expanded && (
        <div className="grid gap-2 px-3 pb-3">
          {run.status !== "completed" && <p className="text-muted-foreground text-xs">Build still running.</p>}
          {artifacts.isLoading && <LoadingState className="py-4" />}
          {artifacts.error && <ErrorState error={artifacts.error} />}
          {artifacts.data?.length === 0 && <p className="text-muted-foreground text-xs">This run produced no artifacts.</p>}
          {artifacts.data?.map((a) => (
            <ArtifactRow
              key={a.id}
              repoId={repoId}
              run={run}
              artifact={a}
              cached={firmware.data?.find((f) => f.artifact_id === a.id)}
              devices={devices.data ?? []}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FirmwareSheet({
  repo,
  open,
  onOpenChange,
}: {
  repo: Repository
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const qc = useQueryClient()
  const builds = useBuilds(repo.id, open && !!repo.github_owner, true)
  const devices = useDevices(open)
  const [expanded, setExpanded] = useState<number | null>(null)
  const runs = builds.data?.runs ?? []
  const latestSuccess = runs.find((r) => r.conclusion === "success")
  const shown = expanded ?? latestSuccess?.id ?? null

  const dispatch = useMutation({
    mutationFn: () => endpoints.dispatch(repo.id, runs[0].workflow_id, builds.data?.branch),
    onSuccess: () => {
      toast.success("Build requested. It shows up here in a few seconds.")
      setTimeout(() => qc.invalidateQueries({ queryKey: keys.builds(repo.id) }), 4000)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const tokenMissing =
    builds.data?.token_source === "none" ||
    (builds.error instanceof ApiError && builds.error.code === "github_token_required")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Firmware</SheetTitle>
          <SheetDescription>
            GitHub Actions builds of {repo.github_owner}/{repo.github_repo}
            {builds.data?.branch ? ` on ${builds.data.branch}` : ""}
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 overflow-y-auto px-4 pb-6">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => builds.refetch()}
              disabled={builds.isFetching}
            >
              {builds.isFetching ? <Spinner /> : <HugeiconsIcon icon={Refresh01Icon} />} Refresh
            </Button>
            {runs[0] && (
              <Button size="sm" variant="outline" onClick={() => dispatch.mutate()} disabled={dispatch.isPending}>
                {dispatch.isPending ? <Spinner /> : <HugeiconsIcon icon={PlayIcon} />} Run build
              </Button>
            )}
            <div className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
              <HugeiconsIcon icon={UsbIcon} className="size-4" />
              {devices.data?.length
                ? devices.data.map((d) => d.name).join(", ")
                : "No bootloader drive"}
            </div>
          </div>
          {tokenMissing && (
            <div className="border-warning/40 bg-warning/10 rounded-lg border px-3 py-2 text-xs">
              Downloading artifacts needs a GitHub token. Add one in Settings, or sign in with{" "}
              <code className="font-mono">gh auth login</code>.
            </div>
          )}
          {builds.isLoading && <LoadingState />}
          {builds.error && !tokenMissing && <ErrorState error={builds.error} />}
          {builds.data && runs.length === 0 && (
            <p className="text-muted-foreground text-sm">No workflow runs for this branch yet. Push to start a build.</p>
          )}
          {runs.map((run) => (
            <RunItem
              key={run.id}
              repoId={repo.id}
              run={run}
              expanded={shown === run.id}
              onToggle={() => setExpanded(shown === run.id ? -1 : run.id)}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
