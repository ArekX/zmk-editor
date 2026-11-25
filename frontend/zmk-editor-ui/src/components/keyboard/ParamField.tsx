import { KeyboardIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useState } from "react"

import { ValuePicker } from "@/components/common/ValuePicker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { encodeParam, parseParam, type BindNode } from "@/lib/zmk/bindings"
import type { Catalog } from "@/lib/zmk/catalog"
import { zmkCodeFor } from "@/lib/zmk/keyCapture"
import { MODIFIER_FNS } from "@/lib/zmk/keycodes"
import { keycodeText, paramText } from "@/lib/zmk/legend"
import { unwrapModifiers, wrapModifiers } from "@/lib/zmk/modifiers"
import { optionsFor } from "@/lib/zmk/options"
import { PARAM_PROMPTS, type ParamSpec } from "@/lib/zmk/params"
import { cn } from "@/lib/utils"

export function ParamField({
  spec,
  node,
  catalog,
  onChange,
}: {
  spec: ParamSpec
  node: BindNode
  catalog: Catalog
  onChange: (node: BindNode) => void
}) {
  const label = spec.name ?? PARAM_PROMPTS[spec.kind]

  if (spec.kind === "raw") {
    return (
      <Field label={label}>
        <RawInput key={encodeParam(node)} value={encodeParam(node)} onChange={(v) => onChange(parseParam(v))} />
      </Field>
    )
  }

  if (spec.kind === "code") {
    return <KeycodeField label={label} spec={spec} node={node} catalog={catalog} onChange={onChange} />
  }

  return (
    <Field label={label}>
      <ValuePicker
        value={node.value}
        options={optionsFor(spec, catalog)}
        onSelect={(v) => onChange(parseParam(v))}
        display={
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs">{encodeParam(node)}</span>
            {spec.kind === "layer" && (
              <span className="text-muted-foreground text-xs">{paramText(node, spec, catalog)}</span>
            )}
          </span>
        }
      />
    </Field>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{label}</div>
      {children}
    </div>
  )
}

function RawInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <Input
      className="font-mono text-xs"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() && text !== value && onChange(text.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter" && text.trim()) onChange(text.trim())
      }}
    />
  )
}

function KeycodeField({
  label,
  spec,
  node,
  catalog,
  onChange,
}: {
  label: string
  spec: ParamSpec
  node: BindNode
  catalog: Catalog
  onChange: (node: BindNode) => void
}) {
  const { mods, base } = unwrapModifiers(node)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === "Escape" && !e.shiftKey) {
        setCapturing(false)
        return
      }
      const code = zmkCodeFor(e.code)
      if (!code) return
      // Modifier keys on their own become the key itself; otherwise held
      // modifiers wrap the key (Ctrl+C -> LC(C)).
      const isMod = /^(L|R)(CTRL|SHFT|ALT|GUI)$/.test(code)
      const held = new Set<string>()
      if (!isMod) {
        if (e.ctrlKey) held.add("LC")
        if (e.shiftKey) held.add("LS")
        if (e.altKey) held.add("LA")
        if (e.metaKey) held.add("LG")
      }
      onChange(wrapModifiers(held, { value: code, params: [] }))
      setCapturing(false)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [capturing, onChange])

  const toggle = (code: string) => {
    const next = new Set(mods)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    onChange(wrapModifiers(next, base))
  }

  return (
    <Field label={label}>
      <div className="flex gap-1.5">
        <ValuePicker
          value={base.value}
          options={optionsFor(spec, catalog)}
          onSelect={(v) => onChange(wrapModifiers(mods, parseParam(v)))}
          display={
            <span className="flex items-center gap-2">
              <span className="bg-muted flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs">
                {keycodeText(node, catalog)}
              </span>
              <span className="font-mono text-xs">{encodeParam(base)}</span>
            </span>
          }
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={capturing ? "default" : "outline"}
              size="icon"
              className={cn("shrink-0 rounded-lg", capturing && "bg-brand text-brand-foreground animate-pulse")}
              onClick={() => setCapturing((c) => !c)}
            >
              <HugeiconsIcon icon={KeyboardIcon} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{capturing ? "Press a key (Esc cancels)" : "Capture from keyboard"}</TooltipContent>
        </Tooltip>
      </div>
      {spec.name !== "hold" && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground mr-1 text-[11px]">with</span>
          {MODIFIER_FNS.map((m) => (
            <button
              key={m.code}
              type="button"
              title={`${m.side === "L" ? "Left" : "Right"} ${m.label} (${m.code})`}
              onClick={() => toggle(m.code)}
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[11px] transition-colors",
                mods.has(m.code)
                  ? "border-brand bg-brand/15 text-brand"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {m.side}
              {m.symbol}
            </button>
          ))}
        </div>
      )}
    </Field>
  )
}
