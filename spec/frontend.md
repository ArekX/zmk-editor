# Frontend

See [frontend/zmk-editor-ui/CLAUDE.md](../frontend/zmk-editor-ui/CLAUDE.md) for the stack and file layout.

## Routes

- `/` - repository cards (branch, changed files, ahead/behind, default keymap) and the Add repository dialog (Clone from URL / Use a local folder).
- `/repos/:id` - the editor. URL params: `keymap` (path; defaults to the repo's default keymap), `tab` (`combos`, `behaviors`, `changes`; absent = layers), `layer` (index; absent = 0).

## Shell

Sticky top bar: logo, breadcrumb (repository switcher / keymap switcher / branch menu), editor actions (undo, redo, Pull with behind count, Save, latest build button, more menu: fetch, pull with rebase, physical layout, open on GitHub, discard unsaved edits), theme toggle, settings. Below it the tab bar with an "Unsaved edits" marker and the keymap path.

## Editor

- **Layers**: layer list (select, double-click rename, add, duplicate as new, delete with a renumbering warning), keyboard canvas scaled to fit, changed keys marked with a dot. Clicking a key opens the binding editor popover: behavior picker (grouped: keys and layers, mouse, system, defined in this keymap), one field per parameter (keycode picker with modifier chips and press-a-key capture, layer picker, command picker, enum picker, free text), the raw devicetree text, and Transparent/None shortcuts. Sensor bindings render as knobs under the keyboard.
- **Combos**: list, keyboard with the base layer dimmed and combo keys highlighted (click toggles), form for name, binding, layers, timeout, prior idle, slow release.
- **Behaviors**: custom behaviors with their source, conditional layers, built-in reference.
- **Changes**: working tree files (per-file discard), commit message, Commit / Commit and push, push of local commits, recent commits, diff.
- **Firmware sheet**: runs of the current branch with status, artifacts, download, save file, flash to a detected bootloader drive, run build.

## Key legends (lib/zmk/legend.ts)

Tag = behavior without `&` (hidden for `&trans`, `&none` and parameterless behaviors). Hold-taps (`&mt`, `&lt`, custom hold-taps) show the tap legend big and the hold legend at the bottom. Keycodes use symbols (⇧ ⌃ ⌥ ⌘ ⌫ ⏎ arrows); modifier functions render as prefixes (`LC(LS(A))` = ⌃⇧A). Layer parameters show the layer name. `RGB_COLOR_HSB(...)` shows "HSB" plus a colour swatch. `&trans` shows ▽ faded.

## Shortcuts

⌘/Ctrl+S save, ⌘/Ctrl+Z undo, ⇧⌘Z or Ctrl+Y redo. Leaving the page with unsaved edits asks first.
