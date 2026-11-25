// What kind of value a behavior parameter takes, and which choices exist.

export type ParamKind = "code" | "mod" | "layer" | "command" | "enum" | "raw"

export interface ParamSpec {
  kind: ParamKind
  /** Human label, e.g. "hold", "tap", "index". */
  name?: string
  /** For "command": the behavior whose command list applies. */
  behavior?: string
  /** For "enum": the allowed values. */
  values?: (string | number)[]
}

export function paramFromName(name: string, behavior: string): ParamSpec {
  switch (name) {
    case "code":
      return { kind: "code" }
    case "mod":
      return { kind: "mod" }
    case "layer":
      return { kind: "layer" }
    case "command":
      return { kind: "command", behavior }
    default:
      return { kind: "raw", name }
  }
}

export const PARAM_PROMPTS: Record<ParamKind, string> = {
  code: "Key code",
  mod: "Modifier",
  layer: "Layer",
  command: "Command",
  enum: "Value",
  raw: "Value",
}
