import { Add01Icon, ArrowTurnBackwardIcon, ArrowTurnForwardIcon, Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { Layer, Layout } from "@/api/types"
import { BindingEditor } from "@/components/keyboard/BindingEditor"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { expandDefines, parseBinding } from "@/lib/zmk/bindings"
import { paramsFor, type Catalog } from "@/lib/zmk/catalog"
import { paramText } from "@/lib/zmk/legend"

function SensorKnob({ binding, catalog }: { binding: string; catalog: Catalog }) {
  const node = parseBinding(expandDefines(binding, catalog.defines))
  const def = catalog.behavior.get(node.value)
  const specs = paramsFor(def, node)
  // A sensor-rotate behavior without cells defines its own rotation pair.
  const pair =
    node.params.length >= 2
      ? [paramText(node.params[0], specs[0], catalog), paramText(node.params[1], specs[1], catalog)]
      : def?.custom?.bindings.length === 2
        ? def.custom.bindings.map((b) => b.replace(/^&kp /, ""))
        : null
  return (
    <div className="bg-key border-key-edge hover:border-brand/60 flex size-28 flex-col items-center justify-center gap-1 rounded-full border shadow-[0_3px_0_0_var(--key-edge)] transition-colors">
      <span className="text-key-muted font-mono text-[10px]">{node.value.replace(/^&/, "")}</span>
      {pair ? (
        <>
          <span className="flex items-center gap-1 text-xs">
            <HugeiconsIcon icon={ArrowTurnForwardIcon} className="size-3" /> {pair[0]}
          </span>
          <span className="flex items-center gap-1 text-xs">
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3" /> {pair[1]}
          </span>
        </>
      ) : (
        <span className="text-sm">{node.value === "&trans" ? "▽" : node.params.map((p) => p.value).join(" ")}</span>
      )}
    </div>
  )
}

export function SensorBindings({
  layer,
  layout,
  catalog,
  onChange,
  onClear,
}: {
  layer: Layer
  layout: Layout
  catalog: Catalog
  onChange: (index: number, binding: string, count: number) => void
  onClear: () => void
}) {
  const count = Math.max(layout.sensors.length, layer.sensor_bindings?.length ?? 0)
  if (count === 0) return null
  const firstSensor = catalog.behaviors.find((b) => b.sensor)?.code ?? "&inc_dec_kp"

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-medium">Sensor bindings</h3>
        {layer.sensor_bindings ? (
          <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={onClear}>
            <HugeiconsIcon icon={Delete02Icon} /> Remove from layer
          </Button>
        ) : (
          <Button
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => onChange(0, `${firstSensor} C_VOL_UP C_VOL_DN`, count)}
          >
            <HugeiconsIcon icon={Add01Icon} /> Add to layer
          </Button>
        )}
      </div>
      {layer.sensor_bindings && (
        <div className="flex flex-wrap gap-8">
          {Array.from({ length: count }, (_, i) => {
            const binding = layer.sensor_bindings?.[i] ?? "&trans"
            return (
              <div key={i} className="flex flex-col items-center gap-2">
                <span className="text-muted-foreground font-mono text-xs">{layout.sensors[i]?.label ?? `Sensor ${i + 1}`}</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button">
                      <SensorKnob binding={binding} catalog={catalog} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96">
                    <BindingEditor
                      sensor
                      binding={binding}
                      catalog={catalog}
                      onChange={(b) => onChange(i, b, count)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
