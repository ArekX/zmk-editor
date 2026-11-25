import type { Layout } from "@/api/types"
import { KeyboardCanvas } from "@/components/keyboard/KeyboardCanvas"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { formatMods, parseMods } from "@/lib/zmk/behaviorEdit"
import { MOD_FLAGS, type PropField } from "@/lib/zmk/behaviorSchemas"
import type { Legend } from "@/lib/zmk/legend"
import { cn } from "@/lib/utils"

export interface KeyboardContext {
  layout: Layout
  legends: Legend[]
}

/** One schema-described property of a behavior. */
export function PropFieldInput({
  field,
  value,
  onChange,
  keyboard,
}: {
  field: PropField
  value: string | boolean
  onChange: (value: string | boolean) => void
  keyboard: KeyboardContext
}) {
  const id = `prop-${field.name}`
  if (field.type === "bool") {
    return (
      <label htmlFor={id} className="flex items-center justify-between gap-3 text-sm">
        <span>
          {field.label}
          {field.help && <span className="text-muted-foreground block text-xs">{field.help}</span>}
        </span>
        <Switch id={id} checked={!!value} onCheckedChange={onChange} />
      </label>
    )
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      <Control id={id} field={field} value={String(value)} onChange={onChange} keyboard={keyboard} />
      {field.help && <p className="text-muted-foreground text-xs">{field.help}</p>}
    </div>
  )
}

function Control({
  id,
  field,
  value,
  onChange,
  keyboard,
}: {
  id: string
  field: PropField
  value: string
  onChange: (value: string) => void
  keyboard: KeyboardContext
}) {
  switch (field.type) {
    case "enum":
      return (
        <Select value={value || "__default"} onValueChange={(v) => onChange(v === "__default" ? "" : v)}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default">Default</SelectItem>
            {field.options?.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case "mods": {
      const flags = new Set(parseMods(value))
      return (
        <div className="flex flex-wrap gap-1">
          {MOD_FLAGS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                const next = new Set(flags)
                if (next.has(f)) next.delete(f)
                else next.add(f)
                onChange(formatMods(MOD_FLAGS.filter((x) => next.has(x))))
              }}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                flags.has(f) ? "border-brand bg-brand/15 text-brand" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.replace("MOD_", "")}
            </button>
          ))}
        </div>
      )
    }
    case "positions": {
      const selected = new Set(value.split(/\s+/).filter(Boolean).map(Number))
      const toggle = (k: number) => {
        const next = new Set(selected)
        if (next.has(k)) next.delete(k)
        else next.add(k)
        onChange([...next].sort((a, b) => a - b).join(" "))
      }
      return (
        <div className="grid gap-2">
          <div className="bg-muted/30 rounded-lg border p-2">
            <KeyboardCanvas
              layout={keyboard.layout}
              legends={keyboard.legends}
              highlighted={selected}
              dimmed
              onKeyClick={toggle}
            />
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate font-mono">{value || "No keys: any key decides"}</span>
            <button type="button" className="underline" onClick={() => onChange("")}>
              Clear
            </button>
          </div>
        </div>
      )
    }
    default:
      return (
        <Input
          id={id}
          className={cn(field.type !== "int" && "font-mono text-xs")}
          inputMode={field.type === "int" ? "numeric" : undefined}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(field.type === "int" ? e.target.value.replace(/[^\d]/g, "") : e.target.value)}
        />
      )
  }
}
