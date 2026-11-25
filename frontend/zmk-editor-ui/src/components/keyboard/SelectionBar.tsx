import { ArrowTurnBackwardIcon, Cancel01Icon, Copy01Icon, Edit02Icon, Task01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { BindingEditor } from "@/components/keyboard/BindingEditor"
import { keepOpenWhileEditing } from "@/lib/editing"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Catalog } from "@/lib/zmk/catalog"

/** Actions for several selected keys. */
export function SelectionBar({
  count,
  catalog,
  binding,
  canRevert,
  onSet,
  onCopy,
  onPaste,
  onRevert,
  onClear,
}: {
  count: number
  catalog: Catalog
  /** Binding of the first selected key, the starting point for "Set". */
  binding: string
  canRevert: boolean
  onSet: (binding: string) => void
  onCopy: () => void
  onPaste: () => void
  onRevert: () => void
  onClear: () => void
}) {
  return (
    <div className="bg-brand/8 flex w-full flex-wrap items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm">
      <span className="mr-2 font-medium">{count} keys selected</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="xs" variant="outline">
            <HugeiconsIcon icon={Edit02Icon} /> Set binding
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="max-h-(--radix-popover-content-available-height) w-[min(42rem,95vw)] overflow-y-auto"
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={keepOpenWhileEditing}
        >
          <BindingEditor title={`Set ${count} keys`} binding={binding} catalog={catalog} onChange={onSet} />
        </PopoverContent>
      </Popover>
      <Button size="xs" variant="outline" onClick={() => onSet("&trans")}>
        Transparent
      </Button>
      <Button size="xs" variant="outline" onClick={() => onSet("&none")}>
        None
      </Button>
      <Button size="xs" variant="outline" onClick={onCopy}>
        <HugeiconsIcon icon={Copy01Icon} /> Copy
      </Button>
      <Button size="xs" variant="outline" onClick={onPaste}>
        <HugeiconsIcon icon={Task01Icon} /> Paste
      </Button>
      {canRevert && (
        <Button size="xs" variant="outline" onClick={onRevert}>
          <HugeiconsIcon icon={ArrowTurnBackwardIcon} /> Revert
        </Button>
      )}
      <Button size="xs" variant="ghost" className="ml-auto" onClick={onClear}>
        <HugeiconsIcon icon={Cancel01Icon} /> Clear (Esc)
      </Button>
    </div>
  )
}
