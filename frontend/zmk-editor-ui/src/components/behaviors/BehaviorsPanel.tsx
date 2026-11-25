import { Add01Icon, Layers01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

import type { BehaviorKind, Keymap, KeymapDocument } from "@/api/types"
import { BehaviorForm } from "@/components/behaviors/BehaviorForm"
import { BuiltinList } from "@/components/behaviors/BuiltinList"
import { ConditionalForm } from "@/components/behaviors/ConditionalForm"
import { OverrideForm } from "@/components/behaviors/OverrideForm"
import { EmptyState } from "@/components/common/States"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  addBehavior,
  addConditional,
  behaviorUses,
  deleteBehavior,
  deleteConditional,
  newBehavior,
  renameBehavior,
  setOverride,
  takenLabels,
  uniqueLabel,
  updateBehavior,
  updateConditional,
} from "@/lib/zmk/behaviorEdit"
import { OVERRIDABLE, schemaFor, SCHEMAS } from "@/lib/zmk/behaviorSchemas"
import type { Catalog } from "@/lib/zmk/catalog"
import { legendFor } from "@/lib/zmk/legend"
import { cn } from "@/lib/utils"

type Selection =
  | { type: "behavior"; index: number }
  | { type: "override"; ref: string }
  | { type: "conditional"; index: number }
  | { type: "builtins" }

const SHORT: Partial<Record<BehaviorKind, string>> = {
  "hold-tap": "ht",
  "mod-morph": "mm",
  "tap-dance": "td",
  macro: "macro",
  "sticky-key": "sk",
}

export function BehaviorsPanel({
  doc,
  keymap,
  catalog,
  update,
}: {
  doc: KeymapDocument
  keymap: Keymap
  catalog: Catalog
  update: (fn: (km: Keymap) => Keymap) => void
}) {
  const [selection, setSelection] = useState<Selection>(
    keymap.behaviors.length ? { type: "behavior", index: 0 } : { type: "builtins" },
  )
  const builtinCodes = useMemo(() => catalog.behaviors.filter((b) => !b.custom).map((b) => b.code), [catalog])
  const keyboard = useMemo(
    () => ({
      layout: doc.layout,
      legends: doc.layout.keys.map((_, i) => legendFor(keymap.layers[0]?.bindings[i], catalog)),
    }),
    [doc.layout, keymap.layers, catalog],
  )

  const create = (kind: BehaviorKind) => {
    const label = uniqueLabel(SHORT[kind] ?? "behavior", takenLabels(keymap, builtinCodes))
    update((km) => addBehavior(km, newBehavior(kind, label)))
    setSelection({ type: "behavior", index: keymap.behaviors.length })
  }
  const createOverride = (ref: string) => {
    update((km) => setOverride(km, ref, []))
    setSelection({ type: "override", ref })
  }
  const createConditional = () => {
    update(addConditional)
    setSelection({ type: "conditional", index: keymap.conditional_layers.length })
  }

  const behavior = selection.type === "behavior" ? keymap.behaviors[selection.index] : undefined
  const override = selection.type === "override" ? keymap.overrides.find((o) => o.ref === selection.ref) : undefined
  const conditional = selection.type === "conditional" ? keymap.conditional_layers[selection.index] : undefined
  const missingOverrides = OVERRIDABLE.filter((r) => !keymap.overrides.some((o) => o.ref === r))

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="justify-start">
              <HugeiconsIcon icon={Add01Icon} /> New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Behavior</DropdownMenuLabel>
            {SCHEMAS.map((s) => (
              <DropdownMenuItem key={s.kind} onSelect={() => create(s.kind)}>
                <span className="flex flex-col">
                  {s.title}
                  <span className="text-muted-foreground text-xs">{s.description}</span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={createConditional}>Conditional layer</DropdownMenuItem>
            {missingOverrides.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Settings of a built-in</DropdownMenuLabel>
                {missingOverrides.map((r) => (
                  <DropdownMenuItem key={r} onSelect={() => createOverride(r)}>
                    <span className="font-mono">{r}</span>
                    <span className="text-muted-foreground text-xs">{catalog.behavior.get(r)?.name}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Group title="Defined in this keymap">
          {keymap.behaviors.map((b, i) => (
            <Item
              key={`${b.id}-${i}`}
              active={selection.type === "behavior" && selection.index === i}
              onClick={() => setSelection({ type: "behavior", index: i })}
              title={`&${b.label}`}
              hint={schemaFor(b)?.title ?? b.kind}
              isNew={!b.id}
            />
          ))}
          {keymap.behaviors.length === 0 && <p className="text-muted-foreground px-2 text-xs">None yet</p>}
        </Group>

        {keymap.overrides.length > 0 && (
          <Group title="Built-in settings">
            {keymap.overrides.map((o) => (
              <Item
                key={o.ref}
                active={selection.type === "override" && selection.ref === o.ref}
                onClick={() => setSelection({ type: "override", ref: o.ref })}
                title={o.ref}
                hint={`${o.props.length} setting${o.props.length === 1 ? "" : "s"}`}
                isNew={!o.id}
              />
            ))}
          </Group>
        )}

        <Group title="Conditional layers">
          {keymap.conditional_layers.map((c, i) => (
            <Item
              key={`${c.id}-${i}`}
              active={selection.type === "conditional" && selection.index === i}
              onClick={() => setSelection({ type: "conditional", index: i })}
              title={c.name}
              hint={`${c.if_layers.map((l) => catalog.layers[l]?.name ?? l).join(" + ")} → ${catalog.layers[c.then_layer]?.name ?? c.then_layer}`}
              isNew={!c.id}
            />
          ))}
          {keymap.conditional_layers.length === 0 && <p className="text-muted-foreground px-2 text-xs">None</p>}
        </Group>

        <Group title="Reference">
          <Item
            active={selection.type === "builtins"}
            onClick={() => setSelection({ type: "builtins" })}
            title="Built-in behaviors"
          />
        </Group>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl">
          {behavior && selection.type === "behavior" ? (
            <BehaviorForm
              key={selection.index}
              behavior={behavior}
              catalog={catalog}
              keyboard={keyboard}
              taken={takenLabels(keymap, builtinCodes, selection.index)}
              uses={behaviorUses(keymap, behavior.label)}
              onChange={(patch) => update((km) => updateBehavior(km, selection.index, patch))}
              onRename={(label) => update((km) => renameBehavior(km, selection.index, label))}
              onDelete={() => {
                update((km) => deleteBehavior(km, selection.index))
                setSelection(
                  keymap.behaviors.length > 1
                    ? { type: "behavior", index: Math.max(0, selection.index - 1) }
                    : { type: "builtins" },
                )
              }}
            />
          ) : override ? (
            <OverrideForm
              override={override}
              catalog={catalog}
              keyboard={keyboard}
              onChange={(props) => update((km) => setOverride(km, override.ref, props))}
              onDelete={() => {
                update((km) => setOverride(km, override.ref, null))
                setSelection({ type: "builtins" })
              }}
            />
          ) : conditional && selection.type === "conditional" ? (
            <ConditionalForm
              layer={conditional}
              catalog={catalog}
              onChange={(patch) => update((km) => updateConditional(km, selection.index, patch))}
              onDelete={() => {
                update((km) => deleteConditional(km, selection.index))
                setSelection({ type: "builtins" })
              }}
            />
          ) : selection.type === "builtins" ? (
            <BuiltinList catalog={catalog} />
          ) : (
            <EmptyState icon={Layers01Icon} title="Nothing selected">
              Pick a behavior on the left or create a new one.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-muted-foreground px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">{title}</div>
      {children}
    </div>
  )
}

function Item({
  active,
  onClick,
  title,
  hint,
  isNew,
}: {
  active: boolean
  onClick: () => void
  title: string
  hint?: string
  isNew?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-lg px-2.5 py-1.5 text-left transition-colors",
        active ? "bg-brand/12" : "hover:bg-muted",
      )}
    >
      <span className="flex w-full items-center gap-1.5 font-mono text-sm">
        <span className="truncate">{title}</span>
        {isNew && <span className="text-brand font-sans text-[10px]">new</span>}
      </span>
      {hint && <span className="text-muted-foreground w-full truncate text-[11px]">{hint}</span>}
    </button>
  )
}
