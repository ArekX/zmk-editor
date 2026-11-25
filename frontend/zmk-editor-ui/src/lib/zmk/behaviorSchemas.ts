import type { BehaviorKind, CustomBehavior } from "@/api/types"

// What the behavior editor offers for each kind of behavior, following
// ZMK's devicetree bindings (zmk/app/dts/bindings/behaviors).

export type FieldType = "int" | "bool" | "enum" | "positions" | "mods" | "keycodes"

export interface PropField {
  name: string
  label: string
  type: FieldType
  help?: string
  options?: string[]
  placeholder?: string
}

/**
 * How `bindings` is edited: "refs" are behaviors without parameters
 * (`<&kp>, <&kp>`), "bindings" are complete bindings.
 */
export interface BindingsShape {
  mode: "refs" | "bindings" | "macro" | "raw"
  /** Fixed labels when the count is fixed (hold, tap). */
  labels?: string[]
  min?: number
}

export interface KindSchema {
  kind: BehaviorKind
  title: string
  description: string
  compatible: string
  bindingCells: number
  bindings: BindingsShape
  props: PropField[]
  /** Starting point for a new behavior of this kind. */
  initial: Pick<CustomBehavior, "bindings" | "props">
}

const HOLD_TAP_PROPS: PropField[] = [
  {
    name: "flavor",
    label: "Flavor",
    type: "enum",
    options: ["hold-preferred", "balanced", "tap-preferred", "tap-unless-interrupted"],
    help: "How a press is decided as hold or tap when another key is involved.",
  },
  {
    name: "tapping-term-ms",
    label: "Tapping term (ms)",
    type: "int",
    placeholder: "200",
    help: "Held longer than this becomes a hold.",
  },
  {
    name: "quick-tap-ms",
    label: "Quick tap (ms)",
    type: "int",
    placeholder: "-",
    help: "Tapping again within this time repeats the tap instead of holding.",
  },
  {
    name: "require-prior-idle-ms",
    label: "Require prior idle (ms)",
    type: "int",
    placeholder: "-",
    help: "Pressed sooner than this after another key always taps.",
  },
  {
    name: "hold-trigger-key-positions",
    label: "Hold trigger keys",
    type: "positions",
    help: "Only these keys pressed next decide a hold (positional hold-tap).",
  },
  {
    name: "hold-trigger-on-release",
    label: "Decide hold on release",
    type: "bool",
    help: "Check hold trigger keys when they are released instead of pressed.",
  },
  {
    name: "retro-tap",
    label: "Retro tap",
    type: "bool",
    help: "Send the tap when held past the tapping term with no other key pressed.",
  },
  { name: "hold-while-undecided", label: "Hold while undecided", type: "bool" },
  { name: "hold-while-undecided-linger", label: "Linger hold while undecided", type: "bool" },
]

const STICKY_PROPS: PropField[] = [
  { name: "release-after-ms", label: "Release after (ms)", type: "int", placeholder: "1000" },
  { name: "quick-release", label: "Quick release", type: "bool", help: "Release as soon as the next key is pressed." },
  { name: "lazy", label: "Lazy", type: "bool", help: "Only press the key right before the next key." },
  { name: "ignore-modifiers", label: "Ignore modifiers", type: "bool" },
]

export const MOD_FLAGS = [
  "MOD_LCTL",
  "MOD_LSFT",
  "MOD_LALT",
  "MOD_LGUI",
  "MOD_RCTL",
  "MOD_RSFT",
  "MOD_RALT",
  "MOD_RGUI",
]

export const SCHEMAS: KindSchema[] = [
  {
    kind: "hold-tap",
    title: "Hold-tap",
    description: "One behavior when tapped, another when held (home row mods, layer-taps).",
    compatible: "zmk,behavior-hold-tap",
    bindingCells: 2,
    bindings: { mode: "refs", labels: ["Hold", "Tap"] },
    props: HOLD_TAP_PROPS,
    initial: {
      bindings: ["&kp", "&kp"],
      props: [
        { name: "flavor", type: "string", value: "balanced" },
        { name: "tapping-term-ms", type: "cells", value: "200" },
      ],
    },
  },
  {
    kind: "mod-morph",
    title: "Mod-morph",
    description: "A different binding while certain modifiers are held.",
    compatible: "zmk,behavior-mod-morph",
    bindingCells: 0,
    bindings: { mode: "bindings", labels: ["Normally", "With modifiers"] },
    props: [
      { name: "mods", label: "Modifiers", type: "mods", help: "Any of these held switches to the second binding." },
      {
        name: "keep-mods",
        label: "Keep modifiers",
        type: "mods",
        help: "Modifiers passed through to the second binding.",
      },
    ],
    initial: {
      bindings: ["&kp BSPC", "&kp DEL"],
      props: [{ name: "mods", type: "cells", value: "(MOD_LSFT|MOD_RSFT)" }],
    },
  },
  {
    kind: "tap-dance",
    title: "Tap-dance",
    description: "A different binding for one, two, three... quick taps.",
    compatible: "zmk,behavior-tap-dance",
    bindingCells: 0,
    bindings: { mode: "bindings", min: 1 },
    props: [{ name: "tapping-term-ms", label: "Tapping term (ms)", type: "int", placeholder: "200" }],
    initial: {
      bindings: ["&kp LSHFT", "&caps_word"],
      props: [{ name: "tapping-term-ms", type: "cells", value: "200" }],
    },
  },
  {
    kind: "macro",
    title: "Macro",
    description: "A sequence of key presses, optionally taking parameters.",
    compatible: "zmk,behavior-macro",
    bindingCells: 0,
    bindings: { mode: "macro" },
    props: [
      { name: "wait-ms", label: "Wait between steps (ms)", type: "int", placeholder: "15" },
      { name: "tap-ms", label: "Tap duration (ms)", type: "int", placeholder: "30" },
    ],
    initial: { bindings: ["&kp H", "&kp I"], props: [] },
  },
  {
    kind: "sticky-key",
    title: "Sticky key",
    description: "Stays pressed until the next key press.",
    compatible: "zmk,behavior-sticky-key",
    bindingCells: 1,
    bindings: { mode: "refs", labels: ["Behavior"] },
    props: STICKY_PROPS,
    initial: { bindings: ["&kp"], props: [{ name: "release-after-ms", type: "cells", value: "1000" }] },
  },
]

export const SENSOR_SCHEMA: KindSchema = {
  kind: "sensor",
  title: "Encoder",
  description: "Bindings for clockwise and counter-clockwise rotation.",
  compatible: "zmk,behavior-sensor-rotate",
  bindingCells: 0,
  bindings: { mode: "bindings", labels: ["Clockwise", "Counter-clockwise"] },
  props: [{ name: "tap-ms", label: "Tap duration (ms)", type: "int", placeholder: "5" }],
  initial: { bindings: [], props: [] },
}

export function schemaFor(b: Pick<CustomBehavior, "kind" | "sensor_binding_cells">): KindSchema | undefined {
  if (b.kind === "sensor") {
    if ((b.sensor_binding_cells ?? 0) > 0) {
      return { ...SENSOR_SCHEMA, bindings: { mode: "refs", labels: ["Clockwise", "Counter-clockwise"] } }
    }
    return SENSOR_SCHEMA
  }
  return SCHEMAS.find((s) => s.kind === b.kind)
}

/** Property fields for overrides of built-in behaviors (`&mt { ... }`). */
export function overrideFields(ref: string): PropField[] {
  switch (ref) {
    case "&mt":
    case "&lt":
      return HOLD_TAP_PROPS.filter((f) => !f.name.startsWith("hold-trigger") || f.name === "hold-trigger-on-release")
    case "&sk":
    case "&sl":
      return STICKY_PROPS
    case "&caps_word":
      return [
        { name: "continue-list", label: "Continue on", type: "keycodes", help: "Keys that do not end caps word." },
        { name: "mods", label: "Modifiers applied", type: "mods" },
      ]
    case "&key_repeat":
      return []
    default:
      return []
  }
}

/** Built-in behaviors whose settings people commonly override. */
export const OVERRIDABLE = ["&mt", "&lt", "&sk", "&sl", "&caps_word"]

/** The macro compatible and #binding-cells for a number of parameters. */
export function macroCompatible(params: number): { compatible: string; cells: number } {
  if (params >= 2) return { compatible: "zmk,behavior-macro-two-param", cells: 2 }
  if (params === 1) return { compatible: "zmk,behavior-macro-one-param", cells: 1 }
  return { compatible: "zmk,behavior-macro", cells: 0 }
}
