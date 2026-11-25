import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { ConditionalLayer } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Catalog } from "@/lib/zmk/catalog"
import { cn } from "@/lib/utils"

/** Turns on a layer while all of the "if" layers are active (tri-layer). */
export function ConditionalForm({
  layer: c,
  catalog,
  onChange,
  onDelete,
}: {
  layer: ConditionalLayer
  catalog: Catalog
  onChange: (patch: Partial<ConditionalLayer>) => void
  onDelete: () => void
}) {
  const toggle = (i: number) => {
    const set = new Set(c.if_layers)
    if (set.has(i)) set.delete(i)
    else set.add(i)
    onChange({ if_layers: [...set].sort((a, b) => a - b) })
  }
  if (c.read_only) {
    return (
      <p className="text-muted-foreground text-sm">
        {c.name} uses macros or expressions for its layers, so it is shown read-only. Edit it in the keymap file.
      </p>
    )
  }
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{c.name}</h2>
        <p className="text-muted-foreground text-sm">
          While every "if" layer is active, the "then" layer turns on too.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cond-name">Name</Label>
        <Input id="cond-name" value={c.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label>If these layers are all active</Label>
        <LayerChips catalog={catalog} selected={c.if_layers} onToggle={toggle} />
        {c.if_layers.length === 0 && <p className="text-destructive text-xs">Pick at least one layer.</p>}
      </div>
      <div className="grid gap-1.5">
        <Label>Then turn on</Label>
        <LayerChips catalog={catalog} selected={[c.then_layer]} onToggle={(i) => onChange({ then_layer: i })} />
      </div>
      <Button variant="destructive" size="sm" className="justify-self-start" onClick={onDelete}>
        <HugeiconsIcon icon={Delete02Icon} /> Delete conditional layer
      </Button>
    </div>
  )
}

function LayerChips({
  catalog,
  selected,
  onToggle,
}: {
  catalog: Catalog
  selected: number[]
  onToggle: (i: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {catalog.layers.map((l) => (
        <button
          key={l.index}
          type="button"
          onClick={() => onToggle(l.index)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs transition-colors",
            selected.includes(l.index)
              ? "border-brand bg-brand/15 text-brand"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.index} · {l.name}
        </button>
      ))}
    </div>
  )
}
