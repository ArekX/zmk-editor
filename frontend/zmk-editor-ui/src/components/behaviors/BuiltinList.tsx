import type { Catalog } from "@/lib/zmk/catalog"

/** Reference list of ZMK's built-in behaviors. */
export function BuiltinList({ catalog }: { catalog: Catalog }) {
  const builtins = catalog.behaviors.filter((b) => !b.custom)
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Built-in behaviors</h2>
        <p className="text-muted-foreground text-sm">
          Behaviors ZMK provides. Change the settings of some of them (mod-tap, layer-tap, sticky keys, caps word) with
          New → Settings of a built-in.
        </p>
      </div>
      <div className="bg-card divide-y rounded-xl border">
        {builtins.map((b) => (
          <div key={b.code} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-40 shrink-0 font-mono">{b.code}</span>
            <span className="w-40 shrink-0">{b.name}</span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate">{b.description}</span>
            <span className="text-muted-foreground font-mono text-xs">
              {b.params.map((p) => p.name ?? p.kind).join(", ")}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
