import { KeyboardIcon, RecordIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useState } from "react"

import { ValuePicker } from "@/components/common/ValuePicker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { encodeParam, parseParam, type BindNode } from "@/lib/zmk/bindings"
import type { Catalog } from "@/lib/zmk/catalog"
import { zmkCodeFor } from "@/lib/zmk/keyCapture"
import { keycodeText, paramText } from "@/lib/zmk/legend"
import { EVENT_MOD, modifiersAsKey, unwrapModifiers, wrapModifiers } from "@/lib/zmk/modifiers"
import { KeycodePickerDialog } from "@/components/keyboard/KeycodePicker"
import { MODIFIER_FNS } from "@/lib/zmk/keycodes"
import { optionsFor } from "@/lib/zmk/options"
import { PARAM_PROMPTS, type ParamSpec } from "@/lib/zmk/params"
import { cn } from "@/lib/utils"

export function ParamField({
  spec,
  node,
  catalog,
  onChange,
  onChord,
}: {
  spec: ParamSpec
  node: BindNode
  catalog: Catalog
  onChange: (node: BindNode) => void
  onChord?: (keys: string[]) => void
}) {
  const label = spec.name ?? PARAM_PROMPTS[spec.kind]

  if (spec.kind === "raw") {
    return (
      <Field label={label}>
        <RawInput key={encodeParam(node)} value={encodeParam(node)} onChange={(v) => onChange(parseParam(v))} />
      </Field>
    )
  }

  if (spec.kind === "code" || spec.kind === "mod") {
    return (
      <KeycodeField label={label} spec={spec} node={node} catalog={catalog} onChange={onChange} onChord={onChord} />
    )
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
  onChord,
}: {
  label: string
  spec: ParamSpec
  node: BindNode
  catalog: Catalog
  onChange: (node: BindNode) => void
  onChord?: (keys: string[]) => void
}) {
  const { mods, base } = unwrapModifiers(node)
  const [capturing, setCapturing] = useState(false)
  const [picking, setPicking] = useState(false)

  const toggle = (code: string) => {
    const next = new Set(mods)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    onChange(wrapModifiers(next, base))
  }

  // Capture works like a real chord: modifiers are collected while held
  // and the first other key finishes it (Ctrl+Shift+A -> LC(LS(A))).
  // Releasing modifiers without another key records the modifiers
  // themselves (Ctrl alone -> LCTRL, Ctrl+Shift -> LC(LSHFT)).
  useEffect(() => {
    if (!capturing) return
    const held = new Set<string>()
    const finish = (node: BindNode) => {
      onChange(node)
      setCapturing(false)
    }
    const onDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat) return
      if (e.key === "Escape" && held.size === 0) {
        setCapturing(false)
        return
      }
      const fn = EVENT_MOD[e.code]
      if (fn) {
        held.add(fn)
        return
      }
      const code = zmkCodeFor(e.code)
      if (code) finish(wrapModifiers(held, { value: code, params: [] }))
    }
    const onUp = (e: KeyboardEvent) => {
      if (!EVENT_MOD[e.code] || held.size === 0) return
      e.preventDefault()
      const node = modifiersAsKey(held)
      if (node) finish(node)
    }
    window.addEventListener("keydown", onDown, true)
    window.addEventListener("keyup", onUp, true)
    return () => {
      window.removeEventListener("keydown", onDown, true)
      window.removeEventListener("keyup", onUp, true)
    }
  }, [capturing, onChange])

  return (
    <Field label={label}>
      <div className="flex gap-1.5">
        <ValuePicker
          value={base.value}
          options={optionsFor(spec, catalog)}
          onSelect={(v) => onChange(wrapModifiers(mods, parseParam(v)))}
          placeholder="Search all key codes"
          display={
            <span className="flex items-center gap-2">
              <span className="bg-muted flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs">
                {keycodeText(node, catalog)}
              </span>
              <span className="font-mono text-xs">{encodeParam(node)}</span>
            </span>
          }
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 rounded-lg" onClick={() => setPicking(true)}>
              <HugeiconsIcon icon={KeyboardIcon} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pick on a keyboard</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={capturing ? "default" : "outline"}
              size="icon"
              className={cn("shrink-0 rounded-lg", capturing && "bg-brand text-brand-foreground animate-pulse")}
              onClick={() => setCapturing((c) => !c)}
            >
              <HugeiconsIcon icon={RecordIcon} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {capturing
              ? "Press a key or a combination like Ctrl+Shift+A (Esc cancels)"
              : "Capture: press the key on your keyboard"}
          </TooltipContent>
        </Tooltip>
      </div>
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
      <KeycodePickerDialog
        open={picking}
        onOpenChange={setPicking}
        node={node}
        catalog={catalog}
        onChange={onChange}
        title={`Pick ${label.toLowerCase()}`}
        onChord={onChord}
      />
    </Field>
  )
}
