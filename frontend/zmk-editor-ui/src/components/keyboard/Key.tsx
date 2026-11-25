import { memo, useState, type MouseEvent } from "react"

import type { Legend } from "@/lib/zmk/legend"
import type { KeyBox } from "@/lib/layout/geometry"
import { cn } from "@/lib/utils"

const SIZE: Record<Legend["size"], string> = {
  xl: "text-2xl",
  lg: "text-lg",
  md: "text-sm",
  sm: "text-xs",
  xs: "text-[10px] leading-tight",
}

export interface KeyProps {
  index: number
  box: KeyBox
  legend: Legend
  selected?: boolean
  highlighted?: boolean
  dimmed?: boolean
  changed?: boolean
  /** Marked as the source of a pending swap. */
  marked?: boolean
  onClick?: (index: number, e: MouseEvent) => void
  /** Enables dragging this key onto another (copy when Alt is held). */
  onDragKey?: (from: number, to: number, copy: boolean) => void
}

const DRAG_TYPE = "application/x-zmk-key"

/** One keycap, absolutely positioned and rotated like the physical key. */
export const Key = memo(function Key({
  index,
  box,
  legend,
  selected,
  highlighted,
  dimmed,
  changed,
  marked,
  onClick,
  onDragKey,
}: KeyProps) {
  const quiet = legend.kind === "trans" || legend.kind === "none"
  const [dropTarget, setDropTarget] = useState(false)
  return (
    <button
      type="button"
      data-key={index}
      title={legend.title}
      onClick={(e) => onClick?.(index, e)}
      draggable={!!onDragKey}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, String(index))
        e.dataTransfer.effectAllowed = "copyMove"
      }}
      onDragOver={(e) => {
        if (!onDragKey || !e.dataTransfer.types.includes(DRAG_TYPE)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = e.altKey ? "copy" : "move"
        setDropTarget(true)
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(e) => {
        setDropTarget(false)
        const from = Number(e.dataTransfer.getData(DRAG_TYPE))
        if (!onDragKey || Number.isNaN(from) || e.dataTransfer.getData(DRAG_TYPE) === "") return
        e.preventDefault()
        onDragKey(from, index, e.altKey)
      }}
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        transform: box.angle ? `rotate(${box.angle}deg)` : undefined,
        transformOrigin: `${box.originX}px ${box.originY}px`,
      }}
      className={cn(
        "group absolute flex flex-col items-center justify-center overflow-hidden rounded-[10px] border px-1 text-center transition-[background-color,border-color,box-shadow,opacity] duration-150",
        "bg-key text-key-foreground border-key-edge shadow-[0_3px_0_0_var(--key-edge),0_6px_14px_-8px_rgb(0_0_0/0.45)]",
        "hover:border-brand/60 hover:z-10 hover:bg-[color-mix(in_oklch,var(--key),var(--brand)_10%)]",
        quiet && "bg-key/55 text-key-muted/70 shadow-none",
        legend.kind === "unknown" && "border-warning/60",
        dimmed && "opacity-45",
        highlighted && "border-brand bg-[color-mix(in_oklch,var(--key),var(--brand)_28%)] opacity-100",
        selected && "ring-brand ring-offset-background z-20 ring-2 ring-offset-2",
        marked && "ring-warning ring-offset-background z-20 animate-pulse ring-2 ring-offset-2",
        dropTarget && "border-brand ring-brand/60 z-20 ring-2",
      )}
    >
      {legend.tag && (
        <span className="text-key-muted absolute top-1 left-1.5 max-w-[calc(100%-12px)] truncate font-mono text-[9px] leading-none">
          {legend.tag}
        </span>
      )}
      {changed && <span className="bg-brand absolute top-1.5 right-1.5 size-1.5 rounded-full" />}
      <span
        className={cn(
          "flex max-w-full min-w-0 items-center justify-center gap-1 font-medium",
          SIZE[legend.size],
          legend.hold && "-mt-1",
        )}
      >
        <span className="line-clamp-3 min-w-0 wrap-anywhere">{legend.main}</span>
        {legend.color && (
          <span className="size-2.5 shrink-0 rounded-sm ring-1 ring-black/20" style={{ background: legend.color }} />
        )}
      </span>
      {legend.hold && (
        <span className="text-key-muted absolute inset-x-1 bottom-1 truncate text-[10px] leading-none">
          {legend.hold}
        </span>
      )}
    </button>
  )
})
