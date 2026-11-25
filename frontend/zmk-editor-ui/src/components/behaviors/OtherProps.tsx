import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import type { Prop } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Properties the form has no field for (typos such as quick_tap_ms,
 * options from newer ZMK versions), edited as devicetree text.
 */
export function OtherProps({ props, onChange }: { props: Prop[]; onChange: (props: Prop[]) => void }) {
  const [name, setName] = useState("")
  const add = () => {
    const n = name.trim()
    if (!n || props.some((p) => p.name === n)) return
    onChange([...props, { name: n, type: "bool", value: "" }])
    setName("")
  }
  return (
    <div className="grid gap-2">
      {props.map((p, i) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-44 shrink-0 truncate font-mono text-xs" title={p.name}>
            {p.name}
          </span>
          <Input
            className="h-8 font-mono text-xs"
            placeholder="(flag, no value)"
            value={
              p.type === "bool"
                ? ""
                : p.type === "cells"
                  ? `<${p.value}>`
                  : p.type === "string"
                    ? JSON.stringify(p.value)
                    : p.value
            }
            onChange={(e) => {
              const v = e.target.value
              const next: Prop =
                v.trim() === "" ? { name: p.name, type: "bool", value: "" } : { name: p.name, type: "raw", value: v }
              onChange(props.map((x, j) => (j === i ? next : x)))
            }}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => onChange(props.filter((_, j) => j !== i))}
            title="Remove property"
          >
            <HugeiconsIcon icon={Delete02Icon} />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          className="h-8 w-44 font-mono text-xs"
          placeholder="property-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button size="sm" variant="secondary" onClick={add} disabled={!name.trim()}>
          <HugeiconsIcon icon={Add01Icon} /> Add property
        </Button>
      </div>
    </div>
  )
}
