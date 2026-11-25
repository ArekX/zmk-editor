import type { BuildRun } from "@/api/types"

export function isRunning(run: BuildRun) {
  return run.status !== "completed"
}
