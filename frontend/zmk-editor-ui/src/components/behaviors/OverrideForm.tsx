import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { Override, Prop } from "@/api/types"
import { OtherProps } from "@/components/behaviors/OtherProps"
import { PropFieldInput, type KeyboardContext } from "@/components/behaviors/PropFieldInput"
import { Button } from "@/components/ui/button"
import { fieldProp, fieldValue, setProp } from "@/lib/zmk/behaviorEdit"
import { overrideFields } from "@/lib/zmk/behaviorSchemas"
import type { Catalog } from "@/lib/zmk/catalog"

/** Settings changed on a behavior defined elsewhere (`&mt { ... };`). */
export function OverrideForm({
  override: o,
  catalog,
  keyboard,
  onChange,
  onDelete,
}: {
  override: Override
  catalog: Catalog
  keyboard: KeyboardContext
  onChange: (props: Prop[]) => void
  onDelete: () => void
}) {
  const fields = overrideFields(o.ref)
  const known = new Set(fields.map((f) => f.name))
  const def = catalog.behavior.get(o.ref)
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="font-mono text-2xl font-semibold tracking-tight">{o.ref}</h2>
        <p className="text-muted-foreground text-sm">
          {def ? `Settings of the built-in ${def.name} behavior` : "Settings of a node defined outside this keymap"},
          written as{" "}
          <span className="font-mono">
            {o.ref} {"{ ... };"}
          </span>{" "}
          in the keymap.
        </p>
      </div>
      {fields.length > 0 && (
        <section className="grid gap-4">
          {fields.map((f) => (
            <PropFieldInput
              key={f.name}
              field={f}
              keyboard={keyboard}
              value={fieldValue(o.props, f.name, f.type)}
              onChange={(v) => onChange(setProp(o.props, f.name, fieldProp(f.type, v)))}
            />
          ))}
        </section>
      )}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">{fields.length ? "Other properties" : "Properties"}</h3>
        <OtherProps
          props={o.props.filter((p) => !known.has(p.name))}
          onChange={(next) => onChange([...o.props.filter((p) => known.has(p.name)), ...next])}
        />
      </section>
      <Button variant="destructive" size="sm" className="justify-self-start" onClick={onDelete}>
        <HugeiconsIcon icon={Delete02Icon} /> Remove these settings
      </Button>
    </div>
  )
}
