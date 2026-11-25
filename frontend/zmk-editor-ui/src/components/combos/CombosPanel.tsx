import { Add01Icon, Delete02Icon, LockIcon, ShuffleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

import type { Keymap, KeymapDocument } from "@/api/types"
import { ComboForm } from "@/components/combos/ComboForm"
import { EmptyState } from "@/components/common/States"
import { KeyboardCanvas } from "@/components/keyboard/KeyboardCanvas"
import { Button } from "@/components/ui/button"
import type { Catalog } from "@/lib/zmk/catalog"
import { addCombo, deleteCombo, updateCombo } from "@/lib/zmk/edit"
import { legendFor } from "@/lib/zmk/legend"
import { cn } from "@/lib/utils"

export function CombosPanel({
  doc,
  keymap,
  catalog,
  update,
}: {
  doc: KeymapDocument
  keymap: Keymap
  catalog: Catalog
  update: (fn: (km: Keymap) => Keymap) => void
}) {
  const [selected, setSelected] = useState(0)
  const index = Math.min(selected, keymap.combos.length - 1)
  const combo = keymap.combos[index]
  const baseLayer = keymap.layers[0]

  const legends = useMemo(
    () => doc.layout.keys.map((_, i) => legendFor(baseLayer?.bindings[i], catalog)),
    [doc, baseLayer, catalog],
  )
  const highlighted = useMemo(() => new Set(combo?.key_positions ?? []), [combo])

  const toggleKey = (key: number) => {
    if (!combo || combo.read_only) return
    const set = new Set(combo.key_positions)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    update((km) => updateCombo(km, index, { key_positions: [...set].sort((a, b) => a - b) }))
  }

  const add = () => {
    update(addCombo)
    setSelected(keymap.combos.length)
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-3">
        <div className="text-muted-foreground px-2 pb-1.5 text-[11px] font-medium tracking-wide uppercase">Combos</div>
        {keymap.combos.map((c, i) => (
          <button
            key={`${c.id}-${i}`}
            onClick={() => setSelected(i)}
            className={cn(
              "flex flex-col items-start rounded-lg px-2.5 py-2 text-left transition-colors",
              i === index ? "bg-brand/12" : "hover:bg-muted",
            )}
          >
            <span className="flex w-full items-center gap-1.5 text-sm">
              <span className="truncate">{c.name}</span>
              {c.read_only && <HugeiconsIcon icon={LockIcon} className="text-muted-foreground size-3" />}
              {!c.id && <span className="text-brand text-[10px]">new</span>}
            </span>
            <span className="text-muted-foreground w-full truncate font-mono text-[11px]">
              {c.key_positions.join("+") || "no keys"} → {c.binding}
            </span>
          </button>
        ))}
        <button
          onClick={add}
          className="text-muted-foreground hover:bg-muted hover:text-foreground mt-1 flex h-9 items-center gap-2 rounded-lg px-2 text-sm"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-4" /> Add combo
        </button>
      </aside>

      {combo ? (
        <>
          <div className="canvas-grid flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-8">
            <div className="mx-auto flex w-full max-w-5xl items-baseline gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">{combo.name}</h2>
              <span className="text-muted-foreground text-xs">Click keys to add or remove them from the combo</span>
            </div>
            <KeyboardCanvas
              layout={doc.layout}
              legends={legends}
              highlighted={highlighted}
              dimmed
              onKeyClick={toggleKey}
            />
          </div>
          <aside className="w-96 shrink-0 overflow-y-auto border-l p-5">
            {combo.read_only ? (
              <p className="text-muted-foreground text-sm">
                This combo uses macros or expressions for its positions or layers, so it is shown read-only. Edit
                it in the keymap file directly.
              </p>
            ) : (
              <ComboForm
                combo={combo}
                catalog={catalog}
                onChange={(patch) => update((km) => updateCombo(km, index, patch))}
              />
            )}
            <Button
              variant="destructive"
              size="sm"
              className="mt-6"
              onClick={() => {
                update((km) => deleteCombo(km, index))
                setSelected(Math.max(0, index - 1))
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} /> Delete combo
            </Button>
          </aside>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={ShuffleIcon}
            title="No combos yet"
            action={
              <Button size="sm" onClick={add}>
                <HugeiconsIcon icon={Add01Icon} /> Add combo
              </Button>
            }
          >
            Combos fire a binding when several keys are pressed together.
          </EmptyState>
        </div>
      )}
    </div>
  )
}
