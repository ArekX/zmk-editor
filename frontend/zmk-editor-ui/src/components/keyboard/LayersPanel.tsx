import { ArrowTurnBackwardIcon, ClipboardIcon, Copy01Icon, ShuffleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

import type { Keymap, KeymapDocument } from "@/api/types"
import { BindingEditor } from "@/components/keyboard/BindingEditor"
import { keepOpenWhileEditing } from "@/lib/editing"
import { ExportMenu } from "@/components/keyboard/ExportMenu"
import { KeyboardCanvas } from "@/components/keyboard/KeyboardCanvas"
import { LayerList } from "@/components/keyboard/LayerList"
import { SelectionBar } from "@/components/keyboard/SelectionBar"
import { SensorBindings } from "@/components/keyboard/SensorBindings"
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
import { Button } from "@/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useKeySelection } from "@/hooks/useKeySelection"
import type { Catalog } from "@/lib/zmk/catalog"
import {
  addLayer,
  clearSensorBindings,
  deleteLayer,
  duplicateLayer,
  moveLayer,
  renameLayer,
  revertKeys,
  setBinding,
  setSensorBinding,
} from "@/lib/zmk/edit"
import { legendFor } from "@/lib/zmk/legend"
import { countLayerRefs } from "@/lib/zmk/renumber"
import { addChordMacro } from "@/lib/zmk/behaviorEdit"
import { toast } from "sonner"

export function LayersPanel({
  doc,
  keymap,
  catalog,
  update,
  activeLayer,
  setActiveLayer,
}: {
  doc: KeymapDocument
  keymap: Keymap
  catalog: Catalog
  update: (fn: (km: Keymap) => Keymap) => void
  activeLayer: number
  setActiveLayer: (i: number) => void
}) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)
  const layerIndex = Math.min(activeLayer, keymap.layers.length - 1)
  const layer = keymap.layers[layerIndex]
  const layout = doc.layout
  const sel = useKeySelection({ keymap, layer: layerIndex, update })

  const legends = useMemo(
    () => layout.keys.map((_, i) => legendFor(layer?.bindings[i], catalog)),
    [layout, layer, catalog],
  )

  // The same layer as loaded, matched by node name so moves do not matter.
  const original = useMemo(() => doc.keymap.layers.find((l) => l.id && l.id === layer?.id), [doc, layer])

  const changed = useMemo(() => {
    const set = new Set<number>()
    // New layers are entirely new; marking every key would only be noise.
    layer?.bindings.forEach((b, i) => {
      if (original && original.bindings[i] !== b) set.add(i)
    })
    return set
  }, [original, layer])
  const highlighted = useMemo(() => (sel.selected.length > 1 ? new Set(sel.selected) : undefined), [sel.selected])

  if (!layer) return null
  const keyCount = layout.keys.length
  const single = sel.single
  const revert = (keys: number[]) => update((km) => revertKeys(km, doc.keymap, layerIndex, keys))

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-56 shrink-0 overflow-y-auto border-r p-3">
        <LayerList
          layers={keymap.layers}
          active={layerIndex}
          onSelect={setActiveLayer}
          onAdd={() => {
            update((km) => addLayer(km, `Layer ${km.layers.length}`, keyCount))
            setActiveLayer(keymap.layers.length)
          }}
          onRename={(i, name) => update((km) => renameLayer(km, i, name))}
          onDuplicate={(i) => {
            update((km) => duplicateLayer(km, i))
            setActiveLayer(keymap.layers.length)
          }}
          onDelete={setPendingDelete}
          onMove={(from, to) => {
            update((km) => moveLayer(km, from, to, catalog))
            if (layerIndex === from) setActiveLayer(to)
            else if (from < layerIndex && to >= layerIndex) setActiveLayer(layerIndex - 1)
            else if (from > layerIndex && to <= layerIndex) setActiveLayer(layerIndex + 1)
          }}
        />
      </aside>

      <div className="canvas-grid flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{layer.name}</h2>
          <span className="text-muted-foreground font-mono text-xs">
            layer {layerIndex}
            {layer.id ? ` · ${layer.id}` : " · new"}
          </span>
          <div className="ml-auto flex items-center gap-1.5 self-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={sel.swapping ? "default" : "outline"}
                  onClick={() => (sel.swapping ? sel.cancelSwap() : sel.startSwap())}
                >
                  <HugeiconsIcon icon={ShuffleIcon} /> {sel.swapping ? "Cancel swap" : "Swap keys"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Click a key, then the key to swap it with (any layer). Or drag a key onto another.
              </TooltipContent>
            </Tooltip>
            <ExportMenu keymap={keymap} layout={layout} catalog={catalog} layerIndex={layerIndex} />
          </div>
        </div>

        <div className="mx-auto flex min-h-9 w-full max-w-5xl items-center">
          {sel.swapping ? (
            <div className="bg-warning/10 text-warning flex w-full items-center gap-2 rounded-lg border border-current/20 px-3 py-1.5 text-sm">
              <HugeiconsIcon icon={ShuffleIcon} className="size-4" />
              <span className="flex-1">
                {sel.swapSource
                  ? `Swapping key ${sel.swapSource.key} on ${keymap.layers[sel.swapSource.layer]?.name}: click the key to swap it with. Switch layers to swap across layers.`
                  : "Click the first key to swap."}
              </span>
              <button className="underline" onClick={sel.cancelSwap}>
                Cancel (Esc)
              </button>
            </div>
          ) : sel.selected.length > 1 ? (
            <SelectionBar
              count={sel.selected.length}
              catalog={catalog}
              binding={layer.bindings[sel.selected[0]] ?? "&trans"}
              canRevert={!!original && sel.selected.some((k) => changed.has(k))}
              onSet={sel.setSelection}
              onCopy={sel.copy}
              onPaste={sel.paste}
              onRevert={() => revert(sel.selected.filter((k) => changed.has(k)))}
              onClear={sel.clear}
            />
          ) : (
            <p className="text-muted-foreground text-xs">
              Click a key to edit it. Shift or ⌘ click to select several. ⌘C / ⌘V copy and paste, drag a key onto
              another to swap (⌥ to copy).
            </p>
          )}
        </div>

        <Popover open={single !== null && !sel.swapping} onOpenChange={(o) => !o && sel.clear()}>
          <KeyboardCanvas
            layout={layout}
            legends={legends}
            selected={sel.swapping ? null : single}
            highlighted={highlighted}
            changed={changed}
            marked={sel.swapSource?.layer === layerIndex ? sel.swapSource.key : null}
            onKeyClick={sel.onKeyClick}
            onDragKey={sel.swapping ? undefined : sel.onDragKey}
            renderAnchor={(box) => (
              <PopoverAnchor asChild>
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    transform: box.angle ? `rotate(${box.angle}deg)` : undefined,
                    transformOrigin: `${box.originX}px ${box.originY}px`,
                  }}
                />
              </PopoverAnchor>
            )}
          />
          <PopoverContent
            className="max-h-(--radix-popover-content-available-height) w-[min(42rem,95vw)] overflow-y-auto"
            side="bottom"
            collisionPadding={16}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onEscapeKeyDown={keepOpenWhileEditing}
          >
            {single !== null && (
              <BindingEditor
                title={`Key ${single}${layout.keys[single]?.label ? ` · ${layout.keys[single].label}` : ""}`}
                binding={layer.bindings[single] ?? "&none"}
                catalog={catalog}
                onChange={(b) => update((km) => setBinding(km, layerIndex, single, b))}
                onChord={(keys) => {
                  const builtins = catalog.behaviors.filter((b) => !b.custom).map((b) => b.code)
                  const { label } = addChordMacro(keymap, keys, builtins)
                  update((km) => {
                    const { keymap: next, label: l } = addChordMacro(km, keys, builtins)
                    return setBinding(next, layerIndex, single, `&${l}`)
                  })
                  toast.success(`Key ${single} now runs &${label} (${keys.join(" + ")})`)
                }}
                actions={
                  <>
                    {changed.has(single) && original && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="xs" variant="outline" onClick={() => revert([single])}>
                            <HugeiconsIcon icon={ArrowTurnBackwardIcon} /> Revert
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Back to <span className="font-mono">{original.bindings[single]}</span>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Button size="xs" variant="outline" onClick={() => sel.copy()}>
                      <HugeiconsIcon icon={Copy01Icon} /> Copy
                    </Button>
                    {sel.clip &&
                      !(sel.clip.bindings.length === 1 && sel.clip.bindings[0] === layer.bindings[single]) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="xs" variant="outline" onClick={() => sel.paste()}>
                              <HugeiconsIcon icon={ClipboardIcon} />
                              {sel.clip.bindings.length === 1 ? "Paste" : `Paste ${sel.clip.bindings.length} keys`}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {sel.clip.bindings.length === 1 ? (
                              <span className="font-mono">{sel.clip.bindings[0]}</span>
                            ) : (
                              "Back onto the keys they were copied from, on this layer"
                            )}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => sel.startSwap({ layer: layerIndex, key: single })}
                    >
                      <HugeiconsIcon icon={ShuffleIcon} /> Swap with...
                    </Button>
                  </>
                }
              />
            )}
          </PopoverContent>
        </Popover>

        <SensorBindings
          layer={layer}
          layout={layout}
          catalog={catalog}
          onChange={(i, b, count) => update((km) => setSensorBinding(km, layerIndex, i, b, count))}
          onClear={() => update((km) => clearSensorBindings(km, layerIndex))}
        />
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete layer "{pendingDelete !== null ? keymap.layers[pendingDelete]?.name : ""}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Layers after it move down one index, and bindings, combos and conditional layers that refer to them by
              number are renumbered.
              {pendingDelete !== null && countLayerRefs(keymap, pendingDelete, catalog) > 0 && (
                <>
                  {" "}
                  {countLayerRefs(keymap, pendingDelete, catalog)} reference(s) point at this layer itself and are left
                  as they are; check them after deleting.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete === null) return
                update((km) => deleteLayer(km, pendingDelete, catalog))
                setActiveLayer(Math.max(0, Math.min(layerIndex, keymap.layers.length - 2)))
                setPendingDelete(null)
              }}
            >
              Delete layer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
