# Physical layouts (internal/layout)

Resolution order for a keymap with N keys (N = bindings in its first layer):

1. **Custom**: JSON saved in `custom_layouts` for (repository, keymap path), set from the Physical layout dialog.
2. **JSON files**: `<keymap dir>/<keymap name>.json`, `<keymap dir>/info.json`, `config/info.json`, then any other `*.json` next to the keymap. Accepted shapes: QMK/keymap-editor `{"layouts": {NAME: {"layout": [...]}}, "sensors": [...]}` (the named layout with N keys wins), `{"layout": [...]}`, or a bare array. Keys: `x`, `y` (required), `w` or `u`, `h`, `r`, `rx`, `ry`, `row`, `col`, `label`. Files with the wrong key count are skipped with a warning.
3. **Devicetree**: a `zmk,physical-layout` node anywhere in the repository (`.dtsi`, `.overlay`, `.dts`, `.keymap`; skipping `.git`, west/zmk/zephyr/modules/build dirs, depth 6, files over 512 KiB) whose `keys` has N `&key_physical_attrs w h x y r rx ry` entries (hundredths of a unit / degree). Files whose path contains the keymap name win ties.
4. **Generated**: one row per source line of the first layer, shorter rows centered.

Sensors (encoders) come from the JSON `sensors` array; otherwise from the number of sensor bindings.

Rendering (frontend `lib/layout/geometry.ts`): 1u = 56 px, 6 px gap; rotation by `r` degrees around (`rx`, `ry`) in absolute units, or the key's top-left when absent; the canvas is the rotated bounding box, scaled to the available width (max 1.25x).
