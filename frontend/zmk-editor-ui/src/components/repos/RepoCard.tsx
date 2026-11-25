import {
  ArrowDown02Icon,
  ArrowUp02Icon,
  Delete02Icon,
  Folder01Icon,
  GitBranchIcon,
  Github01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"

import { errorMessage } from "@/api/client"
import { endpoints } from "@/api/endpoints"
import type { Repository } from "@/api/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { keys } from "@/hooks/queries"

export function RepoCard({ repo }: { repo: Repository }) {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState(false)
  const [deleteFiles, setDeleteFiles] = useState(true)
  const remove = useMutation({
    mutationFn: () => endpoints.deleteRepo(repo.id, repo.managed && deleteFiles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.repos })
      toast.success(`Removed ${repo.name}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const st = repo.status
  const changed = st?.files.length ?? 0

  return (
    <>
      <Link
        to={`/repos/${repo.id}`}
        className="group bg-card hover:border-brand/50 relative flex flex-col gap-4 rounded-2xl border p-5 transition-all hover:shadow-lg hover:shadow-black/5"
      >
        <div className="flex items-start gap-3">
          <div className="bg-brand/12 text-brand flex size-10 shrink-0 items-center justify-center rounded-xl">
            <HugeiconsIcon icon={repo.github_owner ? Github01Icon : Folder01Icon} className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{repo.name}</div>
            <div className="text-muted-foreground truncate font-mono text-xs">
              {repo.github_owner ? `${repo.github_owner}/${repo.github_repo}` : repo.remote_url || repo.local_path}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
              <button className="text-muted-foreground hover:bg-muted rounded-md p-1">
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                <HugeiconsIcon icon={Delete02Icon} /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {st ? (
            <>
              <Badge variant="secondary" className="gap-1 font-mono">
                <HugeiconsIcon icon={GitBranchIcon} className="size-3" /> {st.branch}
              </Badge>
              {changed > 0 && <Badge className="bg-warning/15 text-warning">{changed} changed</Badge>}
              {st.ahead > 0 && (
                <Badge variant="secondary" className="gap-0.5">
                  <HugeiconsIcon icon={ArrowUp02Icon} className="size-3" /> {st.ahead}
                </Badge>
              )}
              {st.behind > 0 && (
                <Badge variant="secondary" className="gap-0.5">
                  <HugeiconsIcon icon={ArrowDown02Icon} className="size-3" /> {st.behind}
                </Badge>
              )}
            </>
          ) : (
            <span className="text-destructive">{repo.status_error ?? "Unavailable"}</span>
          )}
          {repo.default_keymap && (
            <span className="text-muted-foreground ml-auto truncate font-mono">{repo.default_keymap}</span>
          )}
        </div>
      </Link>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {repo.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {repo.managed
                ? "The app cloned this repository into its data folder. Unpushed commits and unsaved changes in it are lost if you delete the files."
                : `The folder ${repo.local_path} stays on disk; only the app's entry is removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {repo.managed && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={deleteFiles} onCheckedChange={(v) => setDeleteFiles(v === true)} />
              Delete the cloned files
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
