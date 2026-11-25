import { useSyncExternalStore } from "react"

import type { Catalog } from "@/lib/zmk/catalog"
import { RECENT_BEHAVIORS_SHOWN, recentBehaviors, subscribeRecentBehaviors } from "@/lib/recentBehaviors"

/**
 * The most recently picked behaviors that fit this field: known to the
 * catalogue, encoder behaviors only for encoders, macro steps only in
 * macros.
 */
export function useRecentBehaviors(catalog: Catalog, opts: { sensor: boolean; macro: boolean }): string[] {
  const recent = useSyncExternalStore(subscribeRecentBehaviors, recentBehaviors)
  return recent
    .filter((code) => {
      const def = catalog.behavior.get(code)
      return !!def && def.sensor === opts.sensor && (opts.macro || !def.macro)
    })
    .slice(0, RECENT_BEHAVIORS_SHOWN)
}
