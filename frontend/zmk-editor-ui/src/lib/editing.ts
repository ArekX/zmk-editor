/**
 * onEscapeKeyDown for popovers holding a field marked data-escape-cancels
 * (the ZMK binding editor): Esc while typing there cancels the edit and
 * keeps the popover open.
 */
export function keepOpenWhileEditing(e: KeyboardEvent) {
  if ((document.activeElement as HTMLElement | null)?.dataset.escapeCancels !== undefined) e.preventDefault()
}
