import { Link } from "react-router"

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="bg-brand text-brand-foreground grid size-7 grid-cols-2 gap-0.5 rounded-lg p-1.5">
        <span className="rounded-[2px] bg-current" />
        <span className="rounded-[2px] bg-current opacity-60" />
        <span className="rounded-[2px] bg-current opacity-60" />
        <span className="rounded-[2px] bg-current" />
      </span>
      <span className="hidden sm:inline">ZMK Editor</span>
    </Link>
  )
}
