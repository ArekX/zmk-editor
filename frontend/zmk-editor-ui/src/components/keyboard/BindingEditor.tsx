import { ValuePicker } from "@/components/common/ValuePicker"
import { ParamField } from "@/components/keyboard/ParamField"
import { ZmkBindingField } from "@/components/keyboard/ZmkBindingField"
import { useRecentBehaviors } from "@/hooks/useRecentBehaviors"
import { noteBehaviorUsed } from "@/lib/recentBehaviors"
import { encodeBinding, expandDefines, parseBinding, type BindNode } from "@/lib/zmk/bindings"
import { paramsFor, type Catalog } from "@/lib/zmk/catalog"
import { behaviorOptions, defaultValue } from "@/lib/zmk/options"
import type { ParamSpec } from "@/lib/zmk/params"
import { cn } from "@/lib/utils"

/** Picks parameters for a newly chosen behavior, reusing compatible ones. */
function adaptParams(specs: ParamSpec[], old: BindNode[], oldSpecs: ParamSpec[], catalog: Catalog): BindNode[] {
  const used = new Set<number>()
  return specs.map((spec) => {
    const i = oldSpecs.findIndex((s, j) => !used.has(j) && s.kind === spec.kind && old[j])
    if (i >= 0) {
      used.add(i)
      return old[i]
    }
    return parseBinding(`x ${defaultValue(spec, catalog)}`).params[0]
  })
}

/** Grows (with defaults) or truncates params to the spec count. */
function fitParams(specs: ParamSpec[], params: BindNode[], catalog: Catalog): BindNode[] {
  return specs.map((spec, i) => params[i] ?? parseBinding(`x ${defaultValue(spec, catalog)}`).params[0])
}

export function BindingEditor({
  binding,
  catalog,
  onChange,
  sensor = false,
  macro = false,
  title,
  actions,
  onChord,
}: {
  binding: string
  catalog: Catalog
  onChange: (binding: string) => void
  sensor?: boolean
  /** Offer macro control steps (&macro_tap, ...) too. */
  macro?: boolean
  title?: string
  /** Extra buttons shown next to the title (revert, swap). */
  actions?: React.ReactNode
  /** Turns several keys pressed together into a macro bound here (only for &kp). */
  onChord?: (keys: string[]) => void
}) {
  const node = parseBinding(expandDefines(binding, catalog.defines))
  const def = catalog.behavior.get(node.value)
  const specs = paramsFor(def, node)
  const recent = useRecentBehaviors(catalog, { sensor, macro })

  const setNode = (next: BindNode) => onChange(encodeBinding(next))

  const changeBehavior = (code: string) => {
    noteBehaviorUsed(code)
    if (code === node.value) return
    const nextDef = catalog.behavior.get(code)
    const params = adaptParams(paramsFor(nextDef, { value: code, params: [] }), node.params, specs, catalog)
    // A command may bring extra parameters (BT_SEL -> index).
    setNode({ value: code, params: fitParams(paramsFor(nextDef, { value: code, params }), params, catalog) })
  }

  const changeParam = (i: number, p: BindNode) => {
    const params = [...node.params]
    params[i] = p
    setNode({ value: node.value, params: fitParams(paramsFor(def, { value: node.value, params }), params, catalog) })
  }

  return (
    <div className="grid gap-4">
      {(title || actions) && (
        <div className="flex items-center gap-2">
          {title && <div className="min-w-0 flex-1 truncate text-sm font-medium">{title}</div>}
          {actions}
        </div>
      )}
      <div className="grid gap-1.5">
        <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Behavior</div>
        <ValuePicker
          value={node.value}
          options={behaviorOptions(catalog, sensor, macro)}
          onSelect={changeBehavior}
          placeholder="Search behaviors"
          display={
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">{node.value}</span>
              <span className="text-muted-foreground truncate text-xs">{def?.name ?? "Unknown behavior"}</span>
            </span>
          }
        />
        {recent.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recent.map((code) => {
              const d = catalog.behavior.get(code)
              return (
                <button
                  key={code}
                  type="button"
                  title={`${code}${d?.description ? ` - ${d.description}` : ""}`}
                  onClick={() => changeBehavior(code)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                    code === node.value
                      ? "border-brand bg-brand/15 text-brand"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {d?.name ?? code}
                </button>
              )
            })}
          </div>
        )}
        {def?.description && <p className="text-muted-foreground text-xs">{def.description}</p>}
      </div>
      {specs.map((spec, i) => (
        <ParamField
          key={`${node.value}-${i}`}
          spec={spec}
          node={node.params[i] ?? { value: "", params: [] }}
          catalog={catalog}
          onChange={(p) => changeParam(i, p)}
          onChord={node.value === "&kp" && i === 0 ? onChord : undefined}
        />
      ))}
      <ZmkBindingField key={binding} binding={binding} catalog={catalog} onChange={onChange} sensor={sensor} />
    </div>
  )
}
