import {
  ArrowDown01Icon,
  ArrowDown02Icon,
  Delete02Icon,
  FloppyDiskIcon,
  GridViewIcon,
  Github01Icon,
  MoreHorizontalIcon,
  Redo03Icon,
  Refresh01Icon,
  Undo03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useNavigate } from "react-router"

import type { GitStatus, Repository } from "@/api/types"
import { Spinner } from "@/components/common/Spinner"
import { BranchMenu } from "@/components/editor/BranchMenu"
import { BuildButton } from "@/components/firmware/BuildButton"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useRepos } from "@/hooks/queries"
import type { KeymapDraft } from "@/hooks/useKeymapDraft"
import type { GitActions } from "@/hooks/useGitActions"
import { basename } from "@/lib/format"

function IconAction({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string
  icon: typeof Undo03Icon
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled}>
          <HugeiconsIcon icon={icon} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Breadcrumb (repo / keymap / branch) for the top bar. */
export function EditorBreadcrumb({
  repo,
  keymapPath,
  onKeymap,
  status,
  git,
  dirty,
}: {
  repo: Repository
  keymapPath: string | undefined
  onKeymap: (path: string) => void
  status: GitStatus | undefined
  git: GitActions
  dirty: boolean
}) {
  const navigate = useNavigate()
  const repos = useRepos()
  const keymaps = repo.keymaps ?? []
  return (
    <div className="flex min-w-0 items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="min-w-0 font-medium">
            <span className="truncate">{repo.name}</span>
            <HugeiconsIcon icon={ArrowDown01Icon} className="text-muted-foreground size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Repositories</DropdownMenuLabel>
          {repos.data?.map((r) => (
            <DropdownMenuItem key={r.id} onSelect={() => navigate(`/repos/${r.id}`)}>
              <span className="truncate">{r.name}</span>
              {r.id === repo.id && <span className="bg-brand ml-auto size-1.5 rounded-full" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/")}>All repositories</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-muted-foreground/50">/</span>
      {keymaps.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={dirty}>
              {keymapPath ? basename(keymapPath).replace(/\.keymap$/, "") : "keymap"}
              <HugeiconsIcon icon={ArrowDown01Icon} className="text-muted-foreground size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-auto max-w-[min(36rem,90vw)] min-w-64">
            <DropdownMenuLabel>Keymaps</DropdownMenuLabel>
            {keymaps.map((k) => {
              const dir = k.includes("/") ? k.slice(0, k.lastIndexOf("/")) : ""
              return (
                <DropdownMenuItem
                  key={k}
                  onSelect={() => onKeymap(k)}
                  title={k}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="font-medium">{basename(k).replace(/\.keymap$/, "")}</span>
                    {k === keymapPath && <span className="bg-brand ml-auto size-1.5 shrink-0 rounded-full" />}
                  </span>
                  {dir && <span className="text-muted-foreground w-full truncate font-mono text-[11px]">{dir}/</span>}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="px-2 text-sm">{keymapPath ? basename(keymapPath).replace(/\.keymap$/, "") : "no keymap"}</span>
      )}
      <BranchMenu repoId={repo.id} status={status} git={git} locked={dirty} />
    </div>
  )
}

/** Right-hand toolbar actions of the editor. */
export function EditorActions({
  repo,
  status,
  draft,
  git,
  saving,
  onSave,
  onOpenFirmware,
  onOpenLayout,
}: {
  repo: Repository
  status: GitStatus | undefined
  draft: KeymapDraft
  git: GitActions
  saving: boolean
  onSave: () => void
  onOpenFirmware: () => void
  onOpenLayout: () => void
}) {
  const behind = status?.behind ?? 0
  const pullLabel = draft.dirty ? "Save or discard edits before pulling" : behind ? `Pull ${behind} commit${behind === 1 ? "" : "s"}` : "Pull"
  return (
    <>
      <IconAction label="Undo (⌘Z)" icon={Undo03Icon} onClick={draft.undo} disabled={!draft.canUndo} />
      <IconAction label="Redo (⇧⌘Z)" icon={Redo03Icon} onClick={draft.redo} disabled={!draft.canRedo} />
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              size="sm"
              disabled={draft.dirty || git.pull.isPending}
              onClick={() => git.pull.mutate(false)}
            >
              {git.pull.isPending ? <Spinner /> : <HugeiconsIcon icon={ArrowDown02Icon} />}
              Pull
              {behind > 0 && <span className="bg-brand text-brand-foreground rounded-full px-1.5 text-[10px]">{behind}</span>}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{pullLabel}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            disabled={!draft.dirty || saving}
            onClick={onSave}
            className={draft.dirty ? "bg-brand text-brand-foreground hover:bg-brand/85" : undefined}
          >
            {saving ? <Spinner /> : <HugeiconsIcon icon={FloppyDiskIcon} />} Save
          </Button>
        </TooltipTrigger>
        <TooltipContent>Write changes to the keymap file (⌘S)</TooltipContent>
      </Tooltip>
      <BuildButton repo={repo} onOpen={onOpenFirmware} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <HugeiconsIcon icon={MoreHorizontalIcon} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => git.fetch.mutate()}>
            <HugeiconsIcon icon={Refresh01Icon} /> Fetch from origin
          </DropdownMenuItem>
          <DropdownMenuItem disabled={draft.dirty} onSelect={() => git.pull.mutate(true)}>
            <HugeiconsIcon icon={ArrowDown02Icon} /> Pull with rebase
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenLayout}>
            <HugeiconsIcon icon={GridViewIcon} /> Physical layout
          </DropdownMenuItem>
          {repo.github_owner && (
            <DropdownMenuItem asChild>
              <a href={`https://github.com/${repo.github_owner}/${repo.github_repo}`} target="_blank" rel="noreferrer">
                <HugeiconsIcon icon={Github01Icon} /> Open on GitHub
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={!draft.dirty} onSelect={draft.discard}>
            <HugeiconsIcon icon={Delete02Icon} /> Discard unsaved edits
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
