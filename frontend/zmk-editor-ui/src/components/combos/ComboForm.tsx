import type { Combo } from "@/api/types"
import { BindingEditor } from "@/components/keyboard/BindingEditor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { Catalog } from "@/lib/zmk/catalog"
import { cn } from "@/lib/utils"

function optionalNumber(v: string): number | null {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function ComboForm({
  combo,
  catalog,
  onChange,
}: {
  combo: Combo
  catalog: Catalog
  onChange: (patch: Partial<Combo>) => void
}) {
  const toggleLayer = (i: number) => {
    const set = new Set(combo.layers)
    if (set.has(i)) set.delete(i)
    else set.add(i)
    onChange({ layers: [...set].sort((a, b) => a - b) })
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1.5">
        <Label htmlFor="combo-name">Name</Label>
        <Input id="combo-name" value={combo.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>

      <div className="grid gap-1.5">
        <Label>Key positions</Label>
        <div className="text-muted-foreground text-xs">
          {combo.key_positions.length ? (
            <span className="font-mono">{combo.key_positions.join(" + ")}</span>
          ) : (
            "Click keys on the keyboard to add them."
          )}
        </div>
      </div>

      <BindingEditor
        binding={combo.binding}
        catalog={catalog}
        onChange={(binding) => onChange({ binding })}
      />

      <div className="grid gap-1.5">
        <Label>Active on layers</Label>
        <div className="flex flex-wrap gap-1">
          {catalog.layers.map((l) => (
            <button
              key={l.index}
              type="button"
              onClick={() => toggleLayer(l.index)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                combo.layers.includes(l.index)
                  ? "border-brand bg-brand/15 text-brand"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.index} · {l.name}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {combo.layers.length === 0 ? "No layer selected: active on every layer." : "Only active on the selected layers."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="combo-timeout">Timeout (ms)</Label>
          <Input
            id="combo-timeout"
            inputMode="numeric"
            placeholder="50"
            value={combo.timeout_ms ?? ""}
            onChange={(e) => onChange({ timeout_ms: optionalNumber(e.target.value) })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="combo-idle">Prior idle (ms)</Label>
          <Input
            id="combo-idle"
            inputMode="numeric"
            placeholder="-"
            value={combo.require_prior_idle_ms ?? ""}
            onChange={(e) => onChange({ require_prior_idle_ms: optionalNumber(e.target.value) })}
          />
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          Slow release
          <span className="text-muted-foreground block text-xs">Release only when all keys are released</span>
        </span>
        <Switch checked={combo.slow_release} onCheckedChange={(v) => onChange({ slow_release: v })} />
      </label>
    </div>
  )
}
