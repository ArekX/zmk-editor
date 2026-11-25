import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { endpoints } from "@/api/endpoints"
import type { Keymap } from "@/api/types"
import { buildCatalog, type Catalog } from "@/lib/zmk/catalog"
import { normalizeKeycodes } from "@/lib/zmk/keycodes"
import { keys } from "@/hooks/queries"

/** Loads the built-in catalogue once and merges in the keymap's own behaviors. */
export function useCatalog(keymap: Keymap | undefined): Catalog | undefined {
  const { data } = useQuery({
    queryKey: keys.zmk,
    queryFn: async () => {
      const [behaviors, keycodes] = await Promise.all([endpoints.behaviors(), endpoints.keycodes()])
      return { behaviors, keycodes: normalizeKeycodes(keycodes) }
    },
    staleTime: Infinity,
  })
  return useMemo(
    () => (data && keymap ? buildCatalog(data.behaviors, data.keycodes, keymap) : undefined),
    [data, keymap],
  )
}
