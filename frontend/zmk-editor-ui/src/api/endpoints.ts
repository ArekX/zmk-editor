import { del, get, patch, post, put } from "@/api/client"
import type {
  Artifact,
  BuildsResponse,
  BuiltinBehavior,
  Commit,
  Device,
  FirmwareDownload,
  GitStatus,
  Keymap,
  KeymapDocument,
  RawKeycode,
  Repository,
  Settings,
} from "@/api/types"

const q = (path: string) => `?path=${encodeURIComponent(path)}`

export const endpoints = {
  settings: () => get<Settings>("/api/settings"),
  saveSettings: (body: { github_token?: string }) => put<Settings>("/api/settings", body),
  behaviors: () => get<BuiltinBehavior[]>("/api/zmk/behaviors"),
  keycodes: () => get<RawKeycode[]>("/api/zmk/keycodes"),

  repos: () => get<Repository[]>("/api/repos"),
  repo: (id: number) => get<Repository>(`/api/repos/${id}`),
  addRepo: (body: { url?: string; path?: string; name?: string; branch?: string }) =>
    post<Repository>("/api/repos", body),
  updateRepo: (id: number, body: { name?: string; default_keymap?: string }) =>
    patch<Repository>(`/api/repos/${id}`, body),
  deleteRepo: (id: number, deleteFiles: boolean) =>
    del<void>(`/api/repos/${id}${deleteFiles ? "?delete_files=1" : ""}`),

  status: (id: number) => get<GitStatus>(`/api/repos/${id}/status`),
  diff: (id: number) => get<{ diff: string }>(`/api/repos/${id}/diff`),
  log: (id: number) => get<Commit[]>(`/api/repos/${id}/log`),
  branches: (id: number) => get<string[]>(`/api/repos/${id}/branches`),
  checkout: (id: number, branch: string, create: boolean) =>
    post<GitStatus>(`/api/repos/${id}/checkout`, { branch, create }),
  fetch: (id: number) => post<GitStatus>(`/api/repos/${id}/fetch`),
  pull: (id: number, rebase = false) =>
    post<{ output: string; status: GitStatus }>(`/api/repos/${id}/pull`, { rebase }),
  push: (id: number) => post<GitStatus>(`/api/repos/${id}/push`),
  commit: (id: number, message: string, push: boolean) =>
    post<{ sha: string; status: GitStatus; push_error: string }>(`/api/repos/${id}/commit`, {
      message,
      push,
    }),
  discard: (id: number, paths?: string[]) =>
    post<GitStatus>(`/api/repos/${id}/discard`, { paths: paths ?? [] }),

  keymap: (id: number, path: string) => get<KeymapDocument>(`/api/repos/${id}/keymap${q(path)}`),
  saveKeymap: (id: number, path: string, hash: string, keymap: Keymap) =>
    put<KeymapDocument>(`/api/repos/${id}/keymap${q(path)}`, { hash, keymap }),
  previewKeymap: (id: number, path: string, keymap: Keymap) =>
    post<{ before: string; after: string }>(`/api/repos/${id}/keymap/preview${q(path)}`, {
      keymap,
    }),
  saveLayout: (id: number, path: string, layout: unknown) =>
    put<KeymapDocument>(`/api/repos/${id}/layout${q(path)}`, { layout }),

  builds: (id: number) => get<BuildsResponse>(`/api/repos/${id}/builds`),
  artifacts: (id: number, run: number) => get<Artifact[]>(`/api/repos/${id}/builds/${run}/artifacts`),
  dispatch: (id: number, workflowId: number, ref?: string) =>
    post<void>(`/api/repos/${id}/builds/dispatch`, { workflow_id: workflowId, ref }),
  rerun: (id: number, run: number) => post<void>(`/api/repos/${id}/builds/${run}/rerun`),

  firmware: (id: number) => get<FirmwareDownload[]>(`/api/repos/${id}/firmware`),
  downloadFirmware: (
    id: number,
    body: { artifact_id: number; run_id: number; name: string; head_sha: string },
  ) => post<FirmwareDownload>(`/api/repos/${id}/firmware`, body),
  deleteFirmware: (id: number, fw: number) => del<void>(`/api/repos/${id}/firmware/${fw}`),
  flash: (id: number, fw: number, file: string, device: string) =>
    post<{ status: string; device: string }>(`/api/repos/${id}/firmware/${fw}/flash`, {
      file,
      device,
    }),
  devices: () => get<Device[]>("/api/devices"),
}

export const firmwareFileUrl = (repo: number, fw: number, name: string) =>
  `/api/repos/${repo}/firmware/${fw}/files/${name.split("/").map(encodeURIComponent).join("/")}`
export const firmwareZipUrl = (repo: number, fw: number) => `/api/repos/${repo}/firmware/${fw}/zip`
