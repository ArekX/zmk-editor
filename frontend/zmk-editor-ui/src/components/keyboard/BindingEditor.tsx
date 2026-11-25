import { useState } from "react"

import { ValuePicker } from "@/components/common/ValuePicker"
import { ParamField } from "@/components/keyboard/ParamField"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { encodeBinding, expandDefines, parseBinding, type BindNode } from "@/lib/zmk/bindings"
import { paramsFor, type Catalog } from "@/lib/zmk/catalog"
import { behaviorOptions, defaultValue } from "@/lib/zmk/options"
import type { ParamSpec } from "@/lib/zmk/params"

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
  title,
}: {
  binding: string
  catalog: Catalog
  onChange: (binding: string) => void
  sensor?: boolean
  title?: string
}) {
  const node = parseBinding(expandDefines(binding, catalog.defines))
  const def = catalog.behavior.get(node.value)
  const specs = paramsFor(def, node)

  const setNode = (next: BindNode) => onChange(encodeBinding(next))

  const changeBehavior = (code: string) => {
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
      {title && <div className="text-sm font-medium">{title}</div>}
      <div className="grid gap-1.5">
        <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Behavior</div>
        <ValuePicker
          value={node.value}
          options={behaviorOptions(catalog, sensor)}
          onSelect={changeBehavior}
          placeholder="Search behaviors"
          display={
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">{node.value}</span>
              <span className="text-muted-foreground truncate text-xs">{def?.name ?? "Unknown behavior"}</span>
            </span>
          }
        />
        {def?.description && <p className="text-muted-foreground text-xs">{def.description}</p>}
      </div>
      {specs.map((spec, i) => (
        <ParamField
          key={`${node.value}-${i}`}
          spec={spec}
          node={node.params[i] ?? { value: "", params: [] }}
          catalog={catalog}
          onChange={(p) => changeParam(i, p)}
        />
      ))}
      <RawBinding key={binding} binding={binding} onChange={onChange} />
      {!sensor && (
        <div className="flex gap-1.5">
          <Button size="xs" variant="secondary" onClick={() => onChange("&trans")}>
            Transparent
          </Button>
          <Button size="xs" variant="secondary" onClick={() => onChange("&none")}>
            None
          </Button>
        </div>
      )}
    </div>
  )
}

function RawBinding({ binding, onChange }: { binding: string; onChange: (b: string) => void }) {
  const [text, setText] = useState(binding)
  const apply = () => {
    const t = text.trim()
    if (t && t !== binding) onChange(t)
  }
  return (
    <div className="grid gap-1.5">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">Devicetree</div>
      <Input
        className="font-mono text-xs"
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => e.key === "Enter" && apply()}
      />
    </div>
  )
}
