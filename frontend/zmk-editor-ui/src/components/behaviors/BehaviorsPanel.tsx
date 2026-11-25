import { Layers01Icon } from "@hugeicons/core-free-icons"

import type { Keymap } from "@/api/types"
import { EmptyState } from "@/components/common/States"
import { Badge } from "@/components/ui/badge"
import type { Catalog } from "@/lib/zmk/catalog"

export function BehaviorsPanel({ keymap, catalog }: { keymap: Keymap; catalog: Catalog }) {
  const builtins = catalog.behaviors.filter((b) => !b.custom)
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto grid max-w-5xl gap-10">
        <section className="grid gap-3">
          <div>
            <h2 className="text-lg font-semibold">Defined in this keymap</h2>
            <p className="text-muted-foreground text-sm">
              Behaviors and macros from the keymap file. They show up in the behavior picker; edit their
              definitions in the file itself.
            </p>
          </div>
          {keymap.behaviors.length === 0 ? (
            <EmptyState icon={Layers01Icon} title="No custom behaviors">
              Hold-taps, macros, tap-dances and mod-morphs defined in the keymap appear here.
            </EmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {keymap.behaviors.map((b) => (
                <article key={b.ref} className="bg-card flex flex-col gap-2 rounded-xl border p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{b.ref}</span>
                    <Badge variant="secondary">{b.kind}</Badge>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {b.sensor_binding_cells !== null
                        ? `${b.sensor_binding_cells} sensor cells`
                        : `${b.binding_cells} params`}
                    </span>
                  </div>
                  {b.display_name && <div className="text-muted-foreground text-xs">{b.display_name}</div>}
                  <pre className="bg-muted/50 max-h-48 overflow-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed">
                    {b.source}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </section>

        {keymap.conditional_layers.length > 0 && (
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Conditional layers</h2>
            <div className="grid gap-2">
              {keymap.conditional_layers.map((c) => (
                <div key={c.name} className="bg-card flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm">
                  <span className="font-mono">{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.if_layers.map((l) => catalog.layers[l]?.name ?? l).join(" + ")} →{" "}
                    {catalog.layers[c.then_layer]?.name ?? c.then_layer}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Built-in behaviors</h2>
          <div className="bg-card divide-y rounded-xl border">
            {builtins.map((b) => (
              <div key={b.code} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-32 shrink-0 font-mono">{b.code}</span>
                <span className="w-40 shrink-0">{b.name}</span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate">{b.description}</span>
                <span className="text-muted-foreground font-mono text-xs">
                  {b.params.map((p) => p.name ?? p.kind).join(", ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
