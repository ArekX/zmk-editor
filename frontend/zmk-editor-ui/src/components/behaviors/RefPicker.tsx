import { ValuePicker } from "@/components/common/ValuePicker"
import type { Catalog } from "@/lib/zmk/catalog"
import { behaviorOptions } from "@/lib/zmk/options"

/** Picks a behavior by reference only (`&kp`), as hold-taps and sticky keys take. */
export function RefPicker({
  value,
  catalog,
  onChange,
  sensor = false,
}: {
  value: string
  catalog: Catalog
  onChange: (ref: string) => void
  sensor?: boolean
}) {
  const def = catalog.behavior.get(value)
  const options = behaviorOptions(catalog, false).filter((o) => {
    const d = catalog.behavior.get(o.value)
    return sensor ? true : (d?.params.length ?? 0) > 0
  })
  return (
    <ValuePicker
      value={value}
      options={options}
      onSelect={onChange}
      placeholder="Search behaviors"
      display={
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">{value}</span>
          <span className="text-muted-foreground truncate text-xs">{def?.name ?? "Unknown behavior"}</span>
        </span>
      }
    />
  )
}
