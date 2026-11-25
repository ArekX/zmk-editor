import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState, type ReactNode } from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface PickerOption {
  value: string
  label: string
  hint?: string
  symbol?: string
  group?: string
  keywords?: string[]
}

const MAX_RESULTS = 200

/**
 * A searchable combobox. Free text is accepted: when the query matches no
 * option exactly, a "Use ..." item applies it verbatim.
 */
export function ValuePicker({
  value,
  options,
  onSelect,
  placeholder = "Search",
  display,
  allowCustom = true,
  className,
}: {
  value: string
  options: PickerOption[]
  onSelect: (value: string) => void
  placeholder?: string
  display?: ReactNode
  allowCustom?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, MAX_RESULTS)
    const scored: [number, PickerOption][] = []
    for (const o of options) {
      const v = o.value.toLowerCase()
      let score = -1
      if (v === q) score = 0
      else if (v.startsWith(q)) score = 1
      else if (o.keywords?.some((k) => k.toLowerCase() === q)) score = 1
      else if (o.label.toLowerCase().includes(q) || v.includes(q)) score = 2
      else if (o.hint?.toLowerCase().includes(q) || o.keywords?.some((k) => k.toLowerCase().includes(q))) score = 3
      if (score >= 0) scored.push([score, o])
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].value.length - b[1].value.length)
    return scored.slice(0, MAX_RESULTS).map(([, o]) => o)
  }, [options, query])

  const groups = useMemo(() => {
    const map = new Map<string, PickerOption[]>()
    for (const o of filtered) {
      const g = query ? "Results" : (o.group ?? "")
      map.set(g, [...(map.get(g) ?? []), o])
    }
    return [...map.entries()]
  }, [filtered, query])

  const exact = options.some((o) => o.value.toLowerCase() === query.trim().toLowerCase())
  const pick = (v: string) => {
    onSelect(v)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "border-input bg-input/20 hover:bg-input/40 flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border px-2.5 text-left text-sm transition-colors",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{display ?? value}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} className="text-muted-foreground size-3.5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList className="max-h-72">
            <CommandEmpty>No matches</CommandEmpty>
            {groups.map(([group, items]) => (
              <CommandGroup key={group} heading={group || undefined}>
                {items.map((o) => (
                  <CommandItem key={o.value} value={o.value} onSelect={() => pick(o.value)}>
                    {o.symbol !== undefined && (
                      <span className="bg-muted flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs">
                        {o.symbol}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono text-xs">{o.label}</span>
                      {o.hint && <span className="text-muted-foreground ml-2 text-xs">{o.hint}</span>}
                    </span>
                    {o.value === value && <span className="bg-brand size-1.5 rounded-full" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {allowCustom && query.trim() && !exact && (
              <CommandGroup heading="Custom">
                <CommandItem value={`custom:${query}`} onSelect={() => pick(query.trim())}>
                  Use <span className="font-mono">{query.trim()}</span> as typed
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
