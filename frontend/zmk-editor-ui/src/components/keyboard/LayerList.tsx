import { Add01Icon, Copy01Icon, Delete02Icon, Edit02Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import type { Layer } from "@/api/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function LayerList({
  layers,
  active,
  onSelect,
  onAdd,
  onRename,
  onDuplicate,
  onDelete,
}: {
  layers: Layer[]
  active: number
  onSelect: (i: number) => void
  onAdd: () => void
  onRename: (i: number, name: string) => void
  onDuplicate: (i: number) => void
  onDelete: (i: number) => void
}) {
  const [editing, setEditing] = useState<number | null>(null)
  const [text, setText] = useState("")

  const startRename = (i: number) => {
    setEditing(i)
    setText(layers[i].name)
  }
  const finish = () => {
    if (editing !== null && text.trim()) onRename(editing, text.trim())
    setEditing(null)
  }

  return (
    <nav className="flex flex-col gap-0.5">
      <div className="text-muted-foreground px-2 pb-1.5 text-[11px] font-medium tracking-wide uppercase">Layers</div>
      {layers.map((l, i) => (
        <div
          key={`${l.id}-${i}`}
          onClick={() => onSelect(i)}
          onDoubleClick={() => startRename(i)}
          className={cn(
            "group flex h-9 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-sm transition-colors",
            active === i ? "bg-brand/12 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-xs",
              active === i ? "bg-brand text-brand-foreground" : "bg-muted",
            )}
          >
            {i}
          </span>
          {editing === i ? (
            <input
              autoFocus
              className="bg-background min-w-0 flex-1 rounded border px-1.5 py-0.5 text-sm outline-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={finish}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") finish()
                if (e.key === "Escape") setEditing(null)
              }}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">
              {l.name}
              {!l.id && <span className="text-brand ml-1.5 text-[10px]">new</span>}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="hover:bg-background/60 rounded p-1 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100">
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => startRename(i)}>
                <HugeiconsIcon icon={Edit02Icon} /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDuplicate(i)}>
                <HugeiconsIcon icon={Copy01Icon} /> Duplicate as new layer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={layers.length <= 1} onSelect={() => onDelete(i)}>
                <HugeiconsIcon icon={Delete02Icon} /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="text-muted-foreground hover:bg-muted hover:text-foreground mt-1 flex h-9 items-center gap-2 rounded-lg px-1.5 text-sm"
      >
        <span className="border-border flex size-6 items-center justify-center rounded-md border border-dashed">
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
        </span>
        Add layer
      </button>
    </nav>
  )
}
