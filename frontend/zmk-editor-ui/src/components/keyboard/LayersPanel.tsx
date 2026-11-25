import { useMemo, useState } from "react"

import type { Keymap, KeymapDocument } from "@/api/types"
import { BindingEditor } from "@/components/keyboard/BindingEditor"
import { KeyboardCanvas } from "@/components/keyboard/KeyboardCanvas"
import { LayerList } from "@/components/keyboard/LayerList"
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
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import type { Catalog } from "@/lib/zmk/catalog"
import {
  addLayer,
  clearSensorBindings,
  deleteLayer,
  duplicateLayer,
  renameLayer,
  setBinding,
  setSensorBinding,
} from "@/lib/zmk/edit"
import { legendFor } from "@/lib/zmk/legend"

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
  const [selected, setSelected] = useState<number | null>(null)
  const [pendingDelete, setPendingDelete] = useState<number | null>(null)
  const layerIndex = Math.min(activeLayer, keymap.layers.length - 1)
  const layer = keymap.layers[layerIndex]
  const layout = doc.layout

  const legends = useMemo(
    () => layout.keys.map((_, i) => legendFor(layer?.bindings[i], catalog)),
    [layout, layer, catalog],
  )

  const changed = useMemo(() => {
    const set = new Set<number>()
    // New layers are entirely new; marking every key would only be noise.
    const orig = doc.keymap.layers.find((l) => l.id && l.id === layer?.id)
    layer?.bindings.forEach((b, i) => {
      if (orig && orig.bindings[i] !== b) set.add(i)
    })
    return set
  }, [doc, layer])

  if (!layer) return null
  const keyCount = layout.keys.length

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-56 shrink-0 overflow-y-auto border-r p-3">
        <LayerList
          layers={keymap.layers}
          active={layerIndex}
          onSelect={(i) => {
            setActiveLayer(i)
            setSelected(null)
          }}
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
        />
      </aside>

      <div className="canvas-grid flex min-w-0 flex-1 flex-col gap-10 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl items-baseline gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{layer.name}</h2>
          <span className="text-muted-foreground font-mono text-xs">
            layer {layerIndex}
            {layer.id ? ` · ${layer.id}` : " · new"}
          </span>
        </div>

        <Popover open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
          <KeyboardCanvas
            layout={layout}
            legends={legends}
            selected={selected}
            changed={changed}
            onKeyClick={(i) => setSelected((s) => (s === i ? null : i))}
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
            className="w-96"
            side="bottom"
            collisionPadding={16}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {selected !== null && (
              <BindingEditor
                title={`Key ${selected}${layout.keys[selected]?.label ? ` · ${layout.keys[selected].label}` : ""}`}
                binding={layer.bindings[selected] ?? "&none"}
                catalog={catalog}
                onChange={(b) => update((km) => setBinding(km, layerIndex, selected, b))}
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
            <AlertDialogTitle>Delete layer "{pendingDelete !== null ? keymap.layers[pendingDelete]?.name : ""}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Layers after it move down one index. Bindings that refer to layers by number (such as
              &amp;mo 2) are not renumbered, so check them after deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingDelete === null) return
                update((km) => deleteLayer(km, pendingDelete))
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
