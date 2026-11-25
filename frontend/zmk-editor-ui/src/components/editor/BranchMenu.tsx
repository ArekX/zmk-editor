import { Add01Icon, GitBranchIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import type { GitStatus } from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useBranches } from "@/hooks/queries"
import type { GitActions } from "@/hooks/useGitActions"

export function BranchMenu({
  repoId,
  status,
  git,
  locked,
}: {
  repoId: number
  status: GitStatus | undefined
  git: GitActions
  locked: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const branches = useBranches(repoId, open)
  const name = query.trim()
  const exists = branches.data?.includes(name)

  const go = (branch: string, create: boolean) => {
    git.checkout.mutate({ branch, create })
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 font-mono text-xs" disabled={locked}>
          <HugeiconsIcon icon={GitBranchIcon} className="size-3.5" />
          {status?.branch ?? "..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Switch or create branch" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No branches</CommandEmpty>
            {name && !exists && (
              <CommandGroup>
                <CommandItem value={`create:${name}`} onSelect={() => go(name, true)}>
                  <HugeiconsIcon icon={Add01Icon} /> Create branch <span className="font-mono">{name}</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Branches">
              {branches.data?.map((b) => (
                <CommandItem key={b} value={b} onSelect={() => b !== status?.branch && go(b, false)}>
                  <span className="font-mono text-xs">{b}</span>
                  {b === status?.branch && <span className="bg-brand ml-auto size-1.5 rounded-full" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
