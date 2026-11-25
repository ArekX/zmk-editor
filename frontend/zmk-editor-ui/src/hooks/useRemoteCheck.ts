import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/client"
import { endpoints } from "@/api/endpoints"
import { keys } from "@/hooks/queries"

/**
 * Fetches origin once each time a repository is opened and reports the
 * commits the current branch is missing. The result is dropped when the
 * editor unmounts (gcTime 0), so opening the repository again checks again;
 * it never re-runs on window focus.
 */
export function useRemoteCheck(repoId: number) {
  const qc = useQueryClient()
  const check = useQuery({
    queryKey: keys.remoteCheck(repoId),
    queryFn: async () => {
      const r = await endpoints.remoteCheck(repoId)
      qc.setQueryData(keys.status(repoId), r.status)
      return r
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (check.error) {
      toast.warning(`Could not check origin for new commits: ${errorMessage(check.error)}`, {
        id: `remote-check-${repoId}`,
      })
    }
  }, [check.error, repoId])

  return check
}
