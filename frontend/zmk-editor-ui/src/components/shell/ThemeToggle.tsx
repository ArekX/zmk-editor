import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "@/lib/theme/context"

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}>
          <HugeiconsIcon icon={resolved === "dark" ? Sun03Icon : Moon02Icon} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{resolved === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
    </Tooltip>
  )
}
