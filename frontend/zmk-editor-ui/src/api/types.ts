// Mirrors of the Go API payloads (internal/httpapi, internal/keymap,
// internal/layout, internal/git, internal/github).

export interface FileChange {
  path: string
  status: "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflicted"
}

export interface GitStatus {
  branch: string
  upstream: string
  ahead: number
  behind: number
  head: string
  files: FileChange[]
}

export interface Repository {
  id: number
  name: string
  remote_url: string
  local_path: string
  managed: boolean
  default_keymap: string
  created_at: string
  updated_at: string
  github_owner: string
  github_repo: string
  status: GitStatus | null
  status_error?: string
  keymaps?: string[]
}

export interface Commit {
  sha: string
  short: string
  author: string
  date: string
  subject: string
}

export interface RemoteCheck {
  status: GitStatus
  incoming: Commit[]
}

export interface Layer {
  id: string
  label?: string
  name: string
  bindings: string[]
  sensor_bindings: string[] | null
  shape?: number[]
}

export interface Combo {
  id: string
  name: string
  key_positions: number[]
  binding: string
  layers: number[]
  timeout_ms: number | null
  require_prior_idle_ms: number | null
  slow_release: boolean
  read_only: boolean
}

export type BehaviorKind = "hold-tap" | "macro" | "tap-dance" | "mod-morph" | "sticky-key" | "sensor" | "other"

/** One devicetree property (see internal/keymap Prop). */
export interface Prop {
  name: string
  type: "bool" | "cells" | "string" | "raw"
  value: string
}

export interface CustomBehavior {
  /** Label as read from the file; "" for behaviors created in the editor. */
  id: string
  label: string
  ref: string
  node_name: string
  compatible: string
  kind: BehaviorKind
  display_name: string
  binding_cells: number
  sensor_binding_cells: number | null
  bindings: string[]
  props: Prop[]
  source: string
}

/** A top-level `&ref { ... };` node changing a behavior defined elsewhere. */
export interface Override {
  id: string
  ref: string
  props: Prop[]
}

export interface ConditionalLayer {
  id: string
  name: string
  if_layers: number[]
  then_layer: number
  read_only: boolean
}

export interface Keymap {
  layers: Layer[]
  combos: Combo[]
  behaviors: CustomBehavior[]
  overrides: Override[]
  conditional_layers: ConditionalLayer[]
  defines: Record<string, string>
  includes: string[]
  warnings: string[]
}

export interface LayoutKey {
  x: number
  y: number
  w: number
  h: number
  r?: number
  rx?: number
  ry?: number
  row?: number
  col?: number
  label?: string
}

export interface Layout {
  keys: LayoutKey[]
  sensors: { label: string }[]
  source: "custom" | "json" | "devicetree" | "zmk" | "matrix" | "generated"
  path?: string
  name?: string
}

export interface KeymapDocument {
  path: string
  keymap: Keymap
  layout: Layout
  layout_warnings: string[]
  hash: string
  source: string
  /** Set after a save: likely build problems the save introduced. */
  problems: string[]
}

export interface Settings {
  github_token_set: boolean
  github_token_source: "settings" | "gh" | "none"
  git_available: boolean
  data_dir: string
  version: string
}

export interface BuildRun {
  id: number
  name: string
  display_title: string
  status: "queued" | "in_progress" | "completed" | "waiting" | "requested" | "pending"
  conclusion: string | null
  head_branch: string
  head_sha: string
  event: string
  html_url: string
  workflow_id: number
  run_number: number
  created_at: string
  updated_at: string
}

export interface BuildsResponse {
  owner: string
  repo: string
  branch: string
  token_source: Settings["github_token_source"]
  runs: BuildRun[]
}

export interface Artifact {
  id: number
  name: string
  size_in_bytes: number
  expired: boolean
  created_at: string
  expires_at: string
}

export interface FirmwareFile {
  name: string
  size: number
}

export interface FirmwareDownload {
  id: number
  repository_id: number
  artifact_id: number
  run_id: number
  name: string
  head_sha: string
  created_at: string
  files: FirmwareFile[]
}

export interface Device {
  path: string
  name: string
  model: string
  board_id: string
}

// Built-in catalogue (internal/zmkdata).
export interface BehaviorCommand {
  code: string
  description: string
  additionalParams?: { name: string; type: string; enum?: (string | number)[] }[]
}

export interface BuiltinBehavior {
  code: string
  name: string
  params: string[]
  description: string
  includes?: string[]
  commands?: BehaviorCommand[]
  sensor?: boolean
  /** Macro control behaviors (&macro_tap, ...), only offered in macros. */
  macro?: boolean
}

export interface RawKeycode {
  names: string[]
  description: string
  context: string
  symbol?: string
  faIcon?: string
}
