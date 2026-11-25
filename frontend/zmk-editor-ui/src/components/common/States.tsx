import { Alert02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import type { ReactNode } from "react"

import { Spinner } from "@/components/common/Spinner"
import { cn } from "@/lib/utils"

export function LoadingState({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm", className)}>
      <Spinner /> {label}
    </div>
  )
}

export function ErrorState({ error, action }: { error: unknown; action?: ReactNode }) {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div className="border-destructive/30 bg-destructive/5 text-destructive mx-auto flex max-w-xl flex-col items-start gap-3 rounded-xl border p-4 text-sm">
      <div className="flex items-start gap-2">
        <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
        <span className="break-words whitespace-pre-wrap">{msg}</span>
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconSvgElement
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-2xl">
        <HugeiconsIcon icon={icon} className="size-6" />
      </div>
      <div className="font-medium">{title}</div>
      {children && <div className="text-muted-foreground max-w-sm text-sm">{children}</div>}
      {action}
    </div>
  )
}
