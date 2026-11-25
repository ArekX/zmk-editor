import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { errorMessage } from "@/api/client"
import { endpoints } from "@/api/endpoints"
import { keys } from "@/hooks/queries"

/** Git mutations for one repository, with toasts and cache refreshes. */
export function useGitActions(repoId: number, onTreeChanged?: () => void) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.repo(repoId) })
    qc.invalidateQueries({ queryKey: keys.repos })
  }
  const treeChanged = () => {
    refresh()
    onTreeChanged?.()
  }
  const onError = (err: unknown) => toast.error(errorMessage(err))

  const fetch = useMutation({
    mutationFn: () => endpoints.fetch(repoId),
    onSuccess: (s) => {
      refresh()
      toast.success(s.behind ? `${s.behind} new commit${s.behind === 1 ? "" : "s"} on ${s.upstream}` : "Up to date")
    },
    onError,
  })
  const pull = useMutation({
    mutationFn: (rebase: boolean) => endpoints.pull(repoId, rebase),
    onSuccess: () => {
      treeChanged()
      toast.success("Pulled latest changes")
    },
    onError,
  })
  const push = useMutation({
    mutationFn: () => endpoints.push(repoId),
    onSuccess: () => {
      refresh()
      qc.invalidateQueries({ queryKey: keys.builds(repoId) })
      toast.success("Pushed")
    },
    onError,
  })
  const commit = useMutation({
    mutationFn: (v: { message: string; push: boolean }) => endpoints.commit(repoId, v.message, v.push),
    onSuccess: (r, v) => {
      refresh()
      qc.invalidateQueries({ queryKey: keys.builds(repoId) })
      if (r.push_error) toast.error(`Committed ${r.sha.slice(0, 7)}, but push failed: ${r.push_error}`)
      else toast.success(v.push ? `Committed and pushed ${r.sha.slice(0, 7)}` : `Committed ${r.sha.slice(0, 7)}`)
    },
    onError,
  })
  const discard = useMutation({
    mutationFn: (paths?: string[]) => endpoints.discard(repoId, paths),
    onSuccess: () => {
      treeChanged()
      toast.success("Changes discarded")
    },
    onError,
  })
  const checkout = useMutation({
    mutationFn: (v: { branch: string; create: boolean }) => endpoints.checkout(repoId, v.branch, v.create),
    onSuccess: (s) => {
      treeChanged()
      qc.invalidateQueries({ queryKey: keys.builds(repoId) })
      toast.success(`On branch ${s.branch}`)
    },
    onError,
  })
  return { fetch, pull, push, commit, discard, checkout }
}

export type GitActions = ReturnType<typeof useGitActions>
