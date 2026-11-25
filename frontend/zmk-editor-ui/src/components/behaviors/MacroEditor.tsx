import {
  Add01Icon,
  Alert02Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { BindingField } from "@/components/behaviors/BindingField"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { encodeBinding, parseBinding } from "@/lib/zmk/bindings"
import { macroItems, macroSteps, macroWarnings, type MacroItem } from "@/lib/zmk/behaviorEdit"
import { paramsFor, type Catalog } from "@/lib/zmk/catalog"
import { PARAM_PROMPTS } from "@/lib/zmk/params"
import { cn } from "@/lib/utils"

const CONTROL: Record<string, string> = {
  "&macro_tap": "Tap the following",
  "&macro_press": "Press the following",
  "&macro_release": "Release the following",
  "&macro_pause_for_release": "Pause until the key is released",
}
const TIMED: Record<string, string> = { "&macro_wait_time": "Wait between steps", "&macro_tap_time": "Tap duration" }

/**
 * Edits macro steps. A step that receives a macro parameter shows which
 * one; the macro's compatible and #binding-cells follow from them.
 */
export function MacroEditor({
  steps,
  catalog,
  onChange,
}: {
  steps: string[]
  catalog: Catalog
  onChange: (steps: string[]) => void
}) {
  const items = macroItems(steps)
  const warnings = macroWarnings(items)
  const [dragging, setDragging] = useState<number | null>(null)
  const set = (next: MacroItem[]) => onChange(macroSteps(next))
  const replace = (i: number, it: MacroItem) => set(items.map((x, j) => (j === i ? it : x)))
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    set(next)
  }
  const add = (binding: string) => set([...items, { params: [], binding }])

  /** Passes macro parameter `from` into parameter `to` of item i. */
  const passParam = (i: number, from: number, to: number) => {
    const it = items[i]
    const node = parseBinding(it.binding)
    const params = [...node.params]
    params[to - 1] = { value: "MACRO_PLACEHOLDER", params: [] }
    replace(i, {
      params: [...it.params.filter(([, t]) => t !== to), [from, to]],
      binding: encodeBinding({ value: node.value, params }),
    })
  }
  const dropParam = (i: number, to: number) => {
    const it = items[i]
    replace(i, { ...it, params: it.params.filter(([, t]) => t !== to) })
  }

  return (
    <div className="grid gap-2">
      <ol className="grid gap-1.5">
        {items.map((it, i) => {
          const node = parseBinding(it.binding)
          const specs = paramsFor(catalog.behavior.get(node.value), node)
          return (
            <li
              key={i}
              draggable
              onDragStart={(e) => {
                setDragging(i)
                e.dataTransfer.effectAllowed = "move"
              }}
              onDragOver={(e) => dragging !== null && e.preventDefault()}
              onDrop={() => {
                if (dragging !== null) move(dragging, i)
                setDragging(null)
              }}
              onDragEnd={() => setDragging(null)}
              className={cn(
                "bg-card group flex items-center gap-2 rounded-lg border px-2 py-1.5",
                dragging === i && "opacity-40",
                node.value in CONTROL && "bg-muted/40",
              )}
            >
              <HugeiconsIcon
                icon={DragDropVerticalIcon}
                className="text-muted-foreground size-4 shrink-0 cursor-grab"
              />
              <span className="text-muted-foreground w-5 shrink-0 text-right font-mono text-[11px]">{i + 1}</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {node.value in CONTROL ? (
                  <span className="text-sm">{CONTROL[node.value]}</span>
                ) : node.value in TIMED ? (
                  <span className="flex items-center gap-2 text-sm">
                    {TIMED[node.value]}
                    <Input
                      className="h-7 w-20 text-xs"
                      inputMode="numeric"
                      value={node.params[0]?.value ?? ""}
                      onChange={(e) =>
                        replace(i, { ...it, binding: `${node.value} ${e.target.value.replace(/\D/g, "") || 0}` })
                      }
                    />
                    ms
                  </span>
                ) : (
                  <BindingField
                    binding={it.binding}
                    catalog={catalog}
                    macro
                    className="max-w-72"
                    onChange={(b) => replace(i, { ...it, binding: b })}
                  />
                )}
                {it.params.map(([from, to]) => (
                  <button
                    key={to}
                    type="button"
                    title="Stop passing this parameter"
                    onClick={() => dropParam(i, to)}
                    className="border-brand/50 bg-brand/10 text-brand rounded-md border px-1.5 py-0.5 text-[11px]"
                  >
                    macro param {from} →{" "}
                    {specs[to - 1]
                      ? (specs[to - 1].name ?? PARAM_PROMPTS[specs[to - 1].kind]).toLowerCase()
                      : `param ${to}`}{" "}
                    ×
                  </button>
                ))}
              </div>
              {specs.length > 0 && !(node.value in TIMED) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                      Use parameter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Fill from the macro's parameter</DropdownMenuLabel>
                    {specs.map((s, j) =>
                      [1, 2].map((from) => (
                        <DropdownMenuItem key={`${j}-${from}`} onSelect={() => passParam(i, from, j + 1)}>
                          {s.name ?? PARAM_PROMPTS[s.kind]} ← macro parameter {from}
                        </DropdownMenuItem>
                      )),
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <div className="flex shrink-0 opacity-0 group-hover:opacity-100">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  title="Move up"
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => move(i, i + 1)}
                  disabled={i === items.length - 1}
                  title="Move down"
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => set(items.filter((_, j) => j !== i))}
                  title="Remove step"
                >
                  <HugeiconsIcon icon={Delete02Icon} />
                </Button>
              </div>
            </li>
          )
        })}
      </ol>
      {items.length === 0 && <p className="text-muted-foreground text-sm">No steps yet.</p>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary" className="justify-self-start">
            <HugeiconsIcon icon={Add01Icon} /> Add step
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => add("&kp A")}>Key press</DropdownMenuItem>
          <DropdownMenuSeparator />
          {Object.entries(CONTROL).map(([code, label]) => (
            <DropdownMenuItem key={code} onSelect={() => add(code)}>
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => add("&macro_wait_time 50")}>Wait between steps</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => add("&macro_tap_time 30")}>Tap duration</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {warnings.length > 0 && (
        <ul className="text-warning grid gap-1 text-xs">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5">
              <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-3.5 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
