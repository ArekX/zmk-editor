import { Edit02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Catalog } from "@/lib/zmk/catalog"
import { validateBinding } from "@/lib/zmk/validate"

/**
 * The binding as written in the keymap. Read-only until Edit; typed text
 * is checked (behavior, parameter count, key codes, layers) before it is
 * accepted.
 */
export function ZmkBindingField({
  binding,
  catalog,
  onChange,
  sensor = false,
}: {
  binding: string
  catalog: Catalog
  onChange: (binding: string) => void
  sensor?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(binding)
  const check = editing ? validateBinding(text, catalog, { sensor }) : null

  const start = () => {
    setText(binding)
    setEditing(true)
  }
  const apply = () => {
    if (!check?.ok) return
    if (check.binding !== binding) onChange(check.binding)
    setEditing(false)
  }

  return (
    <div className="grid gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-muted-foreground flex w-fit cursor-default items-center gap-1 text-[11px] font-medium tracking-wide uppercase">
            ZMK binding
            <HugeiconsIcon icon={InformationCircleIcon} className="size-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent>Devicetree text, exactly as it is written in the .keymap file</TooltipContent>
      </Tooltip>
      {editing ? (
        <div className="grid gap-1.5">
          <Input
            autoFocus
            data-escape-cancels
            className="font-mono text-xs"
            value={text}
            spellCheck={false}
            aria-invalid={check?.ok === false}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply()
              if (e.key === "Escape") {
                e.stopPropagation()
                setEditing(false)
              }
            }}
          />
          <div className="flex items-center gap-2">
            {check?.ok === false ? (
              <p className="text-destructive min-w-0 flex-1 text-xs">{check.error}</p>
            ) : (
              <p className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">
                {check?.ok && check.binding !== text.trim() ? `→ ${check.binding}` : "Looks good"}
              </p>
            )}
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="xs" disabled={!check?.ok} onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-1.5">
          <code className="min-w-0 flex-1 truncate text-xs">{binding}</code>
          <Button size="xs" variant="ghost" onClick={start}>
            <HugeiconsIcon icon={Edit02Icon} /> Edit
          </Button>
        </div>
      )}
    </div>
  )
}
