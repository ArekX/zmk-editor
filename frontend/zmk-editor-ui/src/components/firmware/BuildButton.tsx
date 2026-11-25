import { CpuIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { Repository } from "@/api/types"
import { RunStatusIcon } from "@/components/firmware/RunStatusIcon"
import { Button } from "@/components/ui/button"
import { useBuilds } from "@/hooks/queries"
import { isRunning } from "@/lib/builds/run"
import { relativeTime } from "@/lib/format"

/** Toolbar summary of the latest build; opens the firmware sheet. */
export function BuildButton({ repo, onOpen }: { repo: Repository; onOpen: () => void }) {
  const enabled = !!repo.github_owner
  const probe = useBuilds(repo.id, enabled, false)
  const running = probe.data?.runs.some(isRunning) ?? false
  const builds = useBuilds(repo.id, enabled, running)
  if (!enabled) return null
  const latest = builds.data?.runs[0]
  return (
    <Button variant="outline" size="sm" onClick={onOpen} className="gap-2">
      {latest ? <RunStatusIcon run={latest} className="size-3.5" /> : <HugeiconsIcon icon={CpuIcon} />}
      <span className="hidden flex-col items-start leading-none md:flex">
        <span className="text-xs">{latest ? `Build #${latest.run_number}` : "Firmware"}</span>
        {latest && <span className="text-muted-foreground text-[10px]">{relativeTime(latest.created_at)}</span>}
      </span>
    </Button>
  )
}
