import { useState } from "react"

import { BindingEditor } from "@/components/keyboard/BindingEditor"
import { keepOpenWhileEditing } from "@/lib/editing"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Catalog } from "@/lib/zmk/catalog"
import { legendFor } from "@/lib/zmk/legend"
import { cn } from "@/lib/utils"

/** A complete binding shown as a compact button that opens the binding editor. */
export function BindingField({
  binding,
  catalog,
  onChange,
  macro = false,
  className,
}: {
  binding: string
  catalog: Catalog
  onChange: (binding: string) => void
  macro?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const legend = legendFor(binding, catalog)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "bg-background hover:border-brand/60 flex h-9 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-left text-sm transition-colors",
            className,
          )}
        >
          <span className="bg-muted flex h-6 min-w-6 shrink-0 items-center justify-center rounded px-1.5 text-xs font-medium">
            {legend.main || "-"}
          </span>
          <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">{binding}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-(--radix-popover-content-available-height) w-[min(42rem,95vw)] overflow-y-auto"
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={keepOpenWhileEditing}
      >
        <BindingEditor binding={binding} catalog={catalog} onChange={onChange} macro={macro} />
      </PopoverContent>
    </Popover>
  )
}
