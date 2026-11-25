import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import type { CustomBehavior } from "@/api/types"
import { BindingField } from "@/components/behaviors/BindingField"
import { MacroEditor } from "@/components/behaviors/MacroEditor"
import { OtherProps } from "@/components/behaviors/OtherProps"
import { PropFieldInput, type KeyboardContext } from "@/components/behaviors/PropFieldInput"
import { RefPicker } from "@/components/behaviors/RefPicker"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fieldProp, fieldValue, LABEL_PATTERN, setProp } from "@/lib/zmk/behaviorEdit"
import { schemaFor } from "@/lib/zmk/behaviorSchemas"
import type { Catalog } from "@/lib/zmk/catalog"

/** Edits one behavior defined in the keymap. */
export function BehaviorForm({
  behavior: b,
  catalog,
  keyboard,
  taken,
  uses,
  onChange,
  onRename,
  onDelete,
}: {
  behavior: CustomBehavior
  catalog: Catalog
  keyboard: KeyboardContext
  /** Labels the behavior cannot be renamed to. */
  taken: Set<string>
  /** Places that use the behavior; deleting is blocked while there are any. */
  uses: string[]
  onChange: (patch: Partial<CustomBehavior>) => void
  onRename: (label: string) => void
  onDelete: () => void
}) {
  const schema = schemaFor(b)
  const known = new Set(schema?.props.map((p) => p.name) ?? [])
  const other = b.props.filter((p) => !known.has(p.name))

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-2">
        <h2 className="font-mono text-2xl font-semibold tracking-tight">&amp;{b.label}</h2>
        <Badge variant="secondary">{schema?.title ?? b.kind}</Badge>
        {!b.id && <span className="text-brand text-xs">new</span>}
      </div>
      {schema && <p className="text-muted-foreground -mt-4 text-sm">{schema.description}</p>}

      <div className="grid grid-cols-2 gap-3">
        <RenameField key={b.label} label={b.label} taken={taken} onRename={onRename} />
        <div className="grid gap-1.5">
          <Label htmlFor="behavior-display">Display name</Label>
          <Input
            id="behavior-display"
            value={b.display_name}
            placeholder="optional"
            onChange={(e) => onChange({ display_name: e.target.value })}
          />
        </div>
      </div>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{b.kind === "macro" ? "Steps" : "Bindings"}</h3>
        <Bindings behavior={b} catalog={catalog} onChange={(bindings) => onChange({ bindings })} />
      </section>

      {schema && schema.props.length > 0 && (
        <section className="grid gap-4">
          <h3 className="text-sm font-medium">Settings</h3>
          {schema.props.map((f) => (
            <PropFieldInput
              key={f.name}
              field={f}
              keyboard={keyboard}
              value={fieldValue(b.props, f.name, f.type)}
              onChange={(v) => onChange({ props: setProp(b.props, f.name, fieldProp(f.type, v)) })}
            />
          ))}
        </section>
      )}

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{schema ? "Other properties" : "Properties"}</h3>
        <OtherProps
          props={other}
          onChange={(next) => onChange({ props: [...b.props.filter((p) => known.has(p.name)), ...next] })}
        />
      </section>

      {b.source && (
        <details className="text-sm">
          <summary className="text-muted-foreground cursor-pointer text-xs">Source as loaded</summary>
          <pre className="bg-muted/50 mt-2 max-h-64 overflow-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed">
            {b.source}
          </pre>
        </details>
      )}

      <div className="grid gap-2 border-t pt-4">
        <Button
          variant="destructive"
          size="sm"
          className="justify-self-start"
          disabled={uses.length > 0}
          onClick={onDelete}
        >
          <HugeiconsIcon icon={Delete02Icon} /> Delete behavior
        </Button>
        {uses.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Used by {uses.slice(0, 6).join(", ")}
            {uses.length > 6 ? ` and ${uses.length - 6} more` : ""}. Replace those bindings before deleting it.
          </p>
        )}
      </div>
    </div>
  )
}

function RenameField({ label, taken, onRename }: { label: string; taken: Set<string>; onRename: (l: string) => void }) {
  const [text, setText] = useState(label)
  const t = text.trim()
  const error = !LABEL_PATTERN.test(t)
    ? "Letters, digits and _, not starting with a digit"
    : t !== label && taken.has(t)
      ? "Already used"
      : ""
  const commit = () => {
    if (!error && t !== label) onRename(t)
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="behavior-label">Name (reference)</Label>
      <Input
        id="behavior-label"
        className="font-mono"
        value={text}
        aria-invalid={!!error}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        <p className="text-muted-foreground text-xs">Renaming updates every binding that uses it.</p>
      )}
    </div>
  )
}

function Bindings({
  behavior: b,
  catalog,
  onChange,
}: {
  behavior: CustomBehavior
  catalog: Catalog
  onChange: (bindings: string[]) => void
}) {
  const shape = schemaFor(b)?.bindings ?? { mode: "raw" as const }
  const set = (i: number, v: string) => onChange(b.bindings.map((x, j) => (j === i ? v : x)))

  if (shape.mode === "macro") return <MacroEditor steps={b.bindings} catalog={catalog} onChange={onChange} />

  const count = shape.labels ? shape.labels.length : b.bindings.length
  const rows = Array.from({ length: count }, (_, i) => b.bindings[i] ?? (shape.mode === "refs" ? "&kp" : "&none"))
  return (
    <div className="grid gap-2">
      {rows.map((binding, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-muted-foreground w-36 shrink-0 text-xs">{shape.labels?.[i] ?? `Tap ${i + 1}`}</span>
          <div className="min-w-0 flex-1">
            {shape.mode === "refs" ? (
              <RefPicker
                value={binding}
                catalog={catalog}
                onChange={(v) => onChange(rows.map((x, j) => (j === i ? v : x)))}
              />
            ) : shape.mode === "bindings" ? (
              <BindingField
                binding={binding}
                catalog={catalog}
                className="w-full"
                onChange={(v) => onChange(rows.map((x, j) => (j === i ? v : x)))}
              />
            ) : (
              <Input className="font-mono text-xs" value={binding} onChange={(e) => set(i, e.target.value)} />
            )}
          </div>
          {!shape.labels && (
            <Button
              size="icon-sm"
              variant="ghost"
              title="Remove"
              disabled={rows.length <= (shape.min ?? 0)}
              onClick={() => onChange(b.bindings.filter((_, j) => j !== i))}
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          )}
        </div>
      ))}
      {!shape.labels && (
        <Button
          size="sm"
          variant="secondary"
          className="justify-self-start"
          onClick={() => onChange([...b.bindings, "&none"])}
        >
          <HugeiconsIcon icon={Add01Icon} /> Add {b.kind === "tap-dance" ? "tap" : "binding"}
        </Button>
      )}
    </div>
  )
}
