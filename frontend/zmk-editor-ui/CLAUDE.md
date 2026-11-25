# Frontend conventions

This file applies to code under [frontend/zmk-editor-ui/](.). For project-wide context see the [root CLAUDE.md](../../CLAUDE.md).

## Stack

- **React 19**, **TypeScript**, **Vite**, **Tailwind CSS v4** (via `@tailwindcss/vite`, no `tailwind.config.js`), path alias `@/` -> `src/` (in `vite.config.ts` and `tsconfig.app.json`).
- **shadcn/ui** configured in [components.json](components.json) (style `radix-maia`, base color `mist`, icon library `hugeicons`). Add components with `npx shadcn@latest add <name>`; generated files land in `src/components/ui/` (check their imports: the CLI has written `from "cn"` instead of `@/lib/utils` before).
- **Icons come from `@hugeicons/react` + `@hugeicons/core-free-icons`.** Don't swap icon libraries.
- **TanStack Query** for server state (query keys in [src/hooks/queries.ts](src/hooks/queries.ts)), **react-router** for routes, **sonner** for toasts, **cmdk** for searchable pickers.
- Theme: dark by default, `ThemeProvider` toggles the `.dark` class; colours are CSS variables in [src/index.css](src/index.css) (including `--brand`, `--key*` for keycaps).

## Commands

Run from this directory:

```bash
npm run dev         # Vite on 5173; proxies /api to the Go server (make dev wires the port)
npm run build       # tsc -b && vite build -> dist/ (embedded by the Go binary)
npm run typecheck   # tsc -b
npm run lint        # oxlint src (ui/ is generated and ignored)
npm run format      # prettier
```

`npm run typecheck && npm run lint && npm run build` must pass before calling a change done.

## Layout of src/

- `api/` - `types.ts` (mirrors of Go payloads), `client.ts` (fetch wrapper, adds `X-Requested-With`), `endpoints.ts`.
- `hooks/` - `queries.ts` (all queries + keys), `useKeymapDraft.ts` (draft + undo/redo), `useSaveKeymap.ts`, `useGitActions.ts`, `useZmkData.ts` (catalogue), `useEditorShortcuts.ts`.
- `lib/zmk/` - pure ZMK logic: `bindings.ts` (parse/encode binding trees, defines), `keycodes.ts`, `catalog.ts` (built-in + keymap behaviors, parameter specs), `legend.ts` (what a keycap shows), `options.ts` (picker options), `modifiers.ts`, `edit.ts` (immutable keymap edits), `keyCapture.ts`.
- `lib/layout/geometry.ts` - key boxes, rotation, bounds.
- `components/keyboard/` - `KeyboardCanvas`, `Key`, `LayerList`, `LayersPanel`, `BindingEditor`, `ParamField`, `SensorBindings`.
- `components/{combos,behaviors,changes,firmware,editor,repos,shell,common}/` - feature components; `common/` holds shared building blocks (`ValuePicker`, `States`, `Spinner`).
- `routes/` - `HomePage`, `EditorPage`.

## Clean code rules

- **One component per file**, named after it. Small helpers used by exactly one parent may stay colocated.
- **Non-JSX logic goes to `lib/`.** Parsing, legends, geometry and keymap edits are pure functions there, not inside components.
- **Shared pieces move up.** A component imported from outside its feature folder moves to `components/common/`.
- **Stateful route logic goes into hooks**, not wrapper components.
- **Keymap edits are immutable** and go through `draft.update(fn)` so undo/redo works; never mutate the keymap object.
- **No em dashes in UI text.** Use a plain hyphen.
- **~500 line guardrail** per file.
