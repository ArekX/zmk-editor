import { Cancel01Icon, CheckmarkCircle02Icon, Clock01Icon, MinusSignCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { BuildRun } from "@/api/types"
import { Spinner } from "@/components/common/Spinner"
import { isRunning } from "@/lib/builds/run"
import { cn } from "@/lib/utils"

export function RunStatusIcon({ run, className }: { run: BuildRun; className?: string }) {
  if (run.status === "in_progress") return <Spinner className={cn("text-warning", className)} />
  if (isRunning(run)) return <HugeiconsIcon icon={Clock01Icon} className={cn("text-warning size-4", className)} />
  if (run.conclusion === "success")
    return <HugeiconsIcon icon={CheckmarkCircle02Icon} className={cn("text-success size-4", className)} />
  if (run.conclusion === "cancelled" || run.conclusion === "skipped")
    return <HugeiconsIcon icon={MinusSignCircleIcon} className={cn("text-muted-foreground size-4", className)} />
  return <HugeiconsIcon icon={Cancel01Icon} className={cn("text-destructive size-4", className)} />
}
