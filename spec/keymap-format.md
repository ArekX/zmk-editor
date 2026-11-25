# Keymap format

## Reading (internal/dts, internal/keymap/extract.go)

The parser is a lenient devicetree reader that keeps byte offsets for every node and property.

- Preprocessor lines (`#include`, `#define`, `#if...`) are skipped as whole lines (with `\` continuations). Object-like `#define NAME value` are recorded and used to resolve layer numbers (`&mo NAV`), combo positions and bindings shorthands (`___` -> `&trans`). Function-like macros are never expanded.
- Unknown top-level or node-level constructs (macro invocations like `ZMK_HOLD_TAP(...)`, bare macro names) are skipped and reported in `keymap.warnings`; the UI shows them in a dismissible banner.
- **Layers**: children of the first node with `compatible = "zmk,keymap"`, in file order. Name = `display-name`, else legacy `label`, else the node name. Bindings are split into one string per binding: a binding starts at every `&ref` (or a define expanding to one); following tokens are its parameters; parenthesized expressions stay whole. `Shape` records bindings per source line.
- **Combos**: children of the `zmk,combos` node: `key-positions`, `bindings`, `layers`, `timeout-ms`, `require-prior-idle-ms`, `slow-release`. A combo whose positions or layers cannot be resolved to integers is `read_only`.
- **Behaviors**: every labelled node whose compatible starts with `zmk,behavior-`, with kind (hold-tap, macro, tap-dance, mod-morph, sensor, other), `#binding-cells`, `#sensor-binding-cells`, inner bindings and the raw source.
- **Conditional layers**: `zmk,conditional-layers` children (read-only).

## Writing (internal/keymap/apply.go, combos.go)

`Apply(src, model, grid)` re-parses `src` and produces a list of offset edits:

- Layer bindings changed -> replace the `bindings` value. Multi-line values are re-rendered as an aligned table (by layout row/col when every key has them, else by the original line shape, centering short rows); single-line values stay on one line.
- `sensor-bindings` changed -> replaced as `<a>, <b>`; set to null/empty -> property removed.
- Name changed -> `display-name` set (or `label` when the file only uses `label`).
- Layer removed -> its node (and one blank line before it) is deleted.
- Layer added (id "") -> a node `<name>_layer { display-name; bindings; }` appended before the keymap node's closing brace. New layers can only follow existing ones; reordering existing layers is rejected.
- Combos: per-property replace/insert/delete, rename via the node name, deletion, insertion; a `combos` node is created before the keymap node when missing.

Edits are applied back to front; overlap is an internal error. The result must parse again or nothing is written. An unchanged model yields the identical file.
