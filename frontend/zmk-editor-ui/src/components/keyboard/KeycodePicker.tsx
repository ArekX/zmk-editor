import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { encodeParam, type BindNode } from "@/lib/zmk/bindings"
import type { Catalog } from "@/lib/zmk/catalog"
import { MODIFIER_FNS } from "@/lib/zmk/keycodes"
import { keycodeText } from "@/lib/zmk/legend"
import {
  modifierFnOf,
  modifierKeyOf,
  modifiersAsKey,
  toggleModifier,
  unwrapModifiers,
  wrapModifiers,
} from "@/lib/zmk/modifiers"
import { extraKeyGroups, MAIN_ROWS, MEDIA_KEYS, NAV_ROWS, NUMPAD_ROWS, sameKey, type PickerKey } from "@/lib/zmk/qwerty"
import { cn } from "@/lib/utils"

const U = 48 // px per key unit
const GAP = 4

/**
 * Picks a key code on a standard keyboard, in a dialog. Modifier toggles
 * wrap the key (Ctrl + Shift + A = LC(LS(A))) and the resulting key is
 * shown at the top. Clicking a key applies it; the dialog stays open so
 * modifiers can still be changed.
 */
export function KeycodePickerDialog({
  open,
  onOpenChange,
  node,
  catalog,
  onChange,
  title = "Pick a key",
  onChord,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  node: BindNode
  catalog: Catalog
  onChange: (node: BindNode) => void
  title?: string
  /**
   * When set, several normal keys can be selected together; they become a
   * macro pressing all of them (keys in press order, modifiers first).
   */
  onChord?: (keys: string[]) => void
}) {
  // Extra normal keys selected together with the current one.
  const [extra, setExtra] = useState<string[]>([])
  const [filter, setFilter] = useState("")
  const [tab, setTab] = useState("keyboard")
  const groups = useMemo(() => extraKeyGroups(catalog), [catalog])
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setExtra([])
      setFilter("")
      // Open where the current key is.
      const key = unwrapModifiers(node).base.value
      setTab(groups.some((g) => g.keys.some((k) => sameKey(k.code, key, catalog))) ? "other" : "keyboard")
    }
  }
  const q = filter.trim().toUpperCase()
  const visibleGroups = q
    ? groups
        .map((g) => ({
          ...g,
          keys: g.keys.filter((key) => {
            const kc = catalog.keycode.get(key.code)
            return (
              key.label.toUpperCase().includes(q) ||
              (kc?.aliases ?? [key.code]).some((a) => a.includes(q)) ||
              kc?.description.toUpperCase().includes(q)
            )
          }),
        }))
        .filter((g) => g.keys.length > 0)
    : groups
  const { mods, base } = unwrapModifiers(node)
  const desc = catalog.keycode.get(base.value)?.description

  const modFn = (code: string) => modifierFnOf(code, catalog.keycode.get(code)?.aliases)
  // The modifiers currently held: wrapping functions plus a modifier
  // chosen as the key itself.
  const baseFn = base.params.length === 0 ? modFn(base.value) : null
  const held = new Set(mods)
  if (baseFn) held.add(baseFn)
  const shifted = held.has("LS") || held.has("RS")

  const toggle = (fn: string) => onChange(toggleModifier(node, fn, modFn))
  const chordKeys =
    extra.length > 0
      ? [...MODIFIER_FNS.filter((m) => held.has(m.code)).map((m) => modifierKeyOf(m.code)!), base.value, ...extra]
      : []
  const pick = (code: string) => {
    const fn = modFn(code)
    // Modifier keys act like modifiers: they combine with the other keys.
    if (fn) {
      toggle(fn)
      return
    }
    const isBase = !baseFn && sameKey(base.value, code, catalog)
    if (onChord) {
      // Every key toggles: a second normal key starts a chord.
      if (extra.some((k) => sameKey(k, code, catalog))) {
        setExtra(extra.filter((k) => !sameKey(k, code, catalog)))
        return
      }
      if (isBase && extra.length > 0) {
        onChange(wrapModifiers(mods, { value: extra[0], params: [] }))
        setExtra(extra.slice(1))
        return
      }
      if (!isBase && !baseFn) {
        setExtra([...extra, code])
        return
      }
    }
    // Clicking the chosen key again releases it: the held modifiers alone
    // become the key (LC(A) -> LCTRL).
    if (isBase && held.size > 0) {
      const alone = modifiersAsKey(held)
      if (alone) onChange(alone)
      return
    }
    // A normal key keeps the held modifiers (but not a modifier that was
    // the key itself: Ctrl then A is LC(A)).
    onChange(wrapModifiers(held, { value: code, params: [] }))
  }

  const keyButton = (key: PickerKey, i: number) => {
    const w = (key.w ?? 1) * U - GAP
    if (!key.code) return <span key={`gap-${i}`} style={{ width: w, height: U - GAP }} className="shrink-0" />
    const fn = modFn(key.code)
    const active = fn
      ? held.has(fn)
      : sameKey(base.value, key.code, catalog) || extra.some((k) => sameKey(k, key.code, catalog))
    const kc = catalog.keycode.get(key.code)
    const letter = key.label.length === 1 && /[A-Z]/.test(key.label)
    return (
      <button
        key={key.code}
        type="button"
        title={`${key.code}${kc?.description ? ` - ${kc.description}` : ""}`}
        onClick={() => pick(key.code)}
        style={{ width: w, height: U - GAP }}
        className={cn(
          "bg-key text-key-foreground border-key-edge relative flex shrink-0 items-center justify-center rounded-lg border leading-none shadow-[0_2px_0_0_var(--key-edge)] transition-colors",
          "hover:border-brand/70 hover:bg-[color-mix(in_oklch,var(--key),var(--brand)_12%)]",
          key.label.length > 3 ? "text-xs" : "text-sm",
          active && "border-brand bg-brand text-brand-foreground hover:bg-brand",
        )}
      >
        {key.shifted ? (
          <span className="flex flex-col items-center gap-0.5">
            <span className={cn("text-[11px]", shifted ? "font-semibold" : "opacity-55")}>{key.shifted}</span>
            <span className={cn(shifted && "opacity-55")}>{key.label}</span>
          </span>
        ) : (
          <span>{letter && !shifted ? key.label.toLowerCase() : key.label}</span>
        )}
      </button>
    )
  }

  // Keys below the keyboard: sized to their label, with the code underneath.
  const extraButton = (key: PickerKey) => {
    const active = sameKey(base.value, key.code, catalog) || extra.some((k) => sameKey(k, key.code, catalog))
    const kc = catalog.keycode.get(key.code)
    return (
      <button
        key={key.code}
        type="button"
        title={`${kc?.aliases.join(", ") ?? key.code}${kc?.description ? ` - ${kc.description}` : ""}`}
        onClick={() => pick(key.code)}
        style={{ minWidth: U - GAP, height: U - GAP }}
        className={cn(
          "bg-key text-key-foreground border-key-edge flex max-w-48 flex-col items-center justify-center gap-1 rounded-lg border px-2 leading-none shadow-[0_2px_0_0_var(--key-edge)] transition-colors",
          "hover:border-brand/70 hover:bg-[color-mix(in_oklch,var(--key),var(--brand)_12%)]",
          active && "border-brand bg-brand text-brand-foreground hover:bg-brand",
        )}
      >
        <span className={cn("max-w-full truncate", [...key.label].length > 3 ? "text-xs" : "text-sm")}>
          {key.label}
        </span>
        <span className="max-w-full truncate font-mono text-[9px] opacity-55">{key.code}</span>
      </button>
    )
  }

  const rows = (list: PickerKey[][]) =>
    list.map((row, r) => (
      <div key={r} className={cn("flex", r === 0 && "mb-3")} style={{ gap: GAP }}>
        {row.map(keyButton)}
      </div>
    ))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[min(74rem,calc(100vw-2rem))] max-w-none sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {`Click modifiers (Ctrl, Shift, Alt, GUI) to hold them, then a key, like pressing them together. Click a selected key again to release it.${onChord ? " Selecting more than one normal key makes a macro that presses them all." : ""}`}{" "}
            The result is applied right away.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/40 flex items-center gap-4 rounded-xl border px-4 py-3">
          <span className="bg-key border-key-edge flex h-14 min-w-14 items-center justify-center rounded-xl border px-3 text-2xl font-medium shadow-[0_3px_0_0_var(--key-edge)]">
            {chordKeys.length > 0
              ? chordKeys.map((k) => keycodeText({ value: k, params: [] }, catalog)).join("+")
              : keycodeText(node, catalog)}
          </span>
          {chordKeys.length > 0 ? (
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-base">{chordKeys.join(" + ")}</div>
              <div className="text-muted-foreground text-sm">
                Several keys at once need a macro: it presses them together and holds them while the key is held.
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-base">{encodeParam(node)}</div>
              <div className="text-muted-foreground truncate text-sm">
                {[...mods].map((m) => MODIFIER_FNS.find((f) => f.code === m)?.label).join(" + ")}
                {mods.size > 0 && desc ? " + " : ""}
                {desc}
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-1">
            {MODIFIER_FNS.map((m) => (
              <button
                key={m.code}
                type="button"
                title={`${m.side === "L" ? "Left" : "Right"} ${m.label} (${m.code})`}
                onClick={() => toggle(m.code)}
                className={cn(
                  "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                  held.has(m.code)
                    ? "border-brand bg-brand/15 text-brand"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.side} {m.symbol} {m.label}
              </button>
            ))}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="min-h-0 gap-3">
          <TabsList>
            <TabsTrigger value="keyboard">Keyboard</TabsTrigger>
            <TabsTrigger value="other">Other keys</TabsTrigger>
          </TabsList>
          {/* Fixed height so switching tabs does not resize the dialog. */}
          <TabsContent value="keyboard" className="h-[26rem] flex-none overflow-auto">
            <div className="flex w-max gap-6">
              {[MAIN_ROWS, NAV_ROWS, NUMPAD_ROWS].map((list, i) => (
                <div key={i} className="flex flex-col" style={{ gap: GAP }}>
                  {rows(list)}
                </div>
              ))}
            </div>
            <div className="mt-4 flex" style={{ gap: GAP }}>
              {MEDIA_KEYS.map(keyButton)}
            </div>
          </TabsContent>
          <TabsContent value="other" className="flex h-[26rem] flex-none flex-col gap-4">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name, code or symbol"
              className="h-8 max-w-72 shrink-0"
            />
            <div className="-mx-6 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-6 pb-1">
              {visibleGroups.map((g) => (
                <section key={g.title} className="grid gap-2">
                  <h4 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">{g.title}</h4>
                  <div className="flex flex-wrap" style={{ gap: GAP }}>
                    {g.keys.map(extraButton)}
                  </div>
                </section>
              ))}
              {visibleGroups.length === 0 && <p className="text-muted-foreground text-sm">No key matches {filter}.</p>}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {chordKeys.length > 0 ? (
            <>
              <Button variant="outline" onClick={() => setExtra([])}>
                Keep {encodeParam(node)}
              </Button>
              <Button
                onClick={() => {
                  onChord?.(chordKeys)
                  onOpenChange(false)
                }}
              >
                Create macro for {chordKeys.join(" + ")}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
