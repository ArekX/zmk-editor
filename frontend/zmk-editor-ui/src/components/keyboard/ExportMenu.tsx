import { Image01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import type { Keymap, Layout } from "@/api/types"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { downloadBlob, keymapSvg, svgToPng, themeColors, type ImageLayer } from "@/lib/export/keymapImage"
import type { Catalog } from "@/lib/zmk/catalog"
import { legendFor } from "@/lib/zmk/legend"

/** Exports the current layer or all layers as SVG or PNG. */
export function ExportMenu({
  keymap,
  layout,
  catalog,
  layerIndex,
}: {
  keymap: Keymap
  layout: Layout
  catalog: Catalog
  layerIndex: number
}) {
  const run = async (all: boolean, format: "svg" | "png") => {
    const layers: ImageLayer[] = (all ? keymap.layers : [keymap.layers[layerIndex]]).map((l) => ({
      name: l.name,
      legends: layout.keys.map((_, i) => legendFor(l.bindings[i], catalog)),
    }))
    const { svg, width, height } = keymapSvg(layout, layers, themeColors())
    const base = (all ? "keymap" : `keymap-${keymap.layers[layerIndex].name}`).replace(/[^\w.-]+/g, "_")
    try {
      const blob = format === "svg" ? new Blob([svg], { type: "image/svg+xml" }) : await svgToPng(svg, width, height)
      downloadBlob(blob, `${base}.${format}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <HugeiconsIcon icon={Image01Icon} /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>This layer</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => run(false, "png")}>PNG image</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(false, "svg")}>SVG image</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>All {keymap.layers.length} layers</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => run(true, "png")}>PNG image</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(true, "svg")}>SVG image</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
