import type { ReactNode } from "react"

import { Logo } from "@/components/shell/Logo"
import { SettingsDialog } from "@/components/shell/SettingsDialog"
import { ThemeToggle } from "@/components/shell/ThemeToggle"

export function TopBar({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur">
      <Logo />
      {children && <div className="text-muted-foreground/50">/</div>}
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      <div className="flex items-center gap-1.5">{actions}</div>
      <div className="bg-border mx-1 h-6 w-px" />
      <ThemeToggle />
      <SettingsDialog />
    </header>
  )
}
