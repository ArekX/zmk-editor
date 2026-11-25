import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import type { Layout } from "@/api/types"
import { Key } from "@/components/keyboard/Key"
import { keyBox, layoutBounds, type KeyBox } from "@/lib/layout/geometry"
import type { Legend } from "@/lib/zmk/legend"

const PADDING = 24
const MAX_SCALE = 1.25

/**
 * Renders the physical layout scaled to the available width. Legends and
 * key state come from the caller so the same canvas serves layers and
 * combos. renderAnchor positions a popover anchor over the selected key.
 */
export function KeyboardCanvas({
  layout,
  legends,
  selected,
  highlighted,
  dimmed,
  changed,
  onKeyClick,
  renderAnchor,
}: {
  layout: Layout
  legends: Legend[]
  selected?: number | null
  highlighted?: Set<number>
  dimmed?: boolean
  changed?: Set<number>
  onKeyClick?: (index: number) => void
  renderAnchor?: (box: KeyBox) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const bounds = useMemo(() => layoutBounds(layout.keys), [layout])
  const boxes = useMemo(
    () =>
      layout.keys.map((k) => {
        const b = keyBox(k)
        return { ...b, left: b.left - bounds.minX, top: b.top - bounds.minY }
      }),
    [layout, bounds],
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale = width ? Math.min(MAX_SCALE, (width - PADDING * 2) / Math.max(bounds.width, 1)) : 1

  return (
    <div ref={ref} className="w-full">
      <div
        className="relative mx-auto"
        style={{ width: bounds.width * scale, height: bounds.height * scale + 8 }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: bounds.width, height: bounds.height, transform: `scale(${scale})` }}
        >
          {boxes.map((box, i) => (
            <Key
              key={i}
              index={i}
              box={box}
              legend={legends[i]}
              selected={selected === i}
              highlighted={highlighted?.has(i)}
              dimmed={dimmed && !highlighted?.has(i)}
              changed={changed?.has(i)}
              onClick={onKeyClick}
            />
          ))}
          {selected != null && boxes[selected] && renderAnchor?.(boxes[selected])}
        </div>
      </div>
    </div>
  )
}
