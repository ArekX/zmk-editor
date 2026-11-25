import { useQuery } from "@tanstack/react-query"

import { endpoints } from "@/api/endpoints"

// Query keys live here so invalidations stay consistent.
export const keys = {
  settings: ["settings"] as const,
  zmk: ["zmk"] as const,
  repos: ["repos"] as const,
  repo: (id: number) => ["repo", id] as const,
  status: (id: number) => ["repo", id, "status"] as const,
  diff: (id: number) => ["repo", id, "diff"] as const,
  log: (id: number) => ["repo", id, "log"] as const,
  branches: (id: number) => ["repo", id, "branches"] as const,
  keymap: (id: number, path: string) => ["repo", id, "keymap", path] as const,
  builds: (id: number) => ["repo", id, "builds"] as const,
  artifacts: (id: number, run: number) => ["repo", id, "artifacts", run] as const,
  firmware: (id: number) => ["repo", id, "firmware"] as const,
  devices: ["devices"] as const,
}

export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: endpoints.settings })

export const useRepos = () => useQuery({ queryKey: keys.repos, queryFn: endpoints.repos })

export const useRepo = (id: number) =>
  useQuery({ queryKey: keys.repo(id), queryFn: () => endpoints.repo(id) })

export const useStatus = (id: number) =>
  useQuery({ queryKey: keys.status(id), queryFn: () => endpoints.status(id), refetchInterval: 15_000 })

export const useDiff = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.diff(id), queryFn: () => endpoints.diff(id), enabled })

export const useLog = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.log(id), queryFn: () => endpoints.log(id), enabled })

export const useBranches = (id: number, enabled = true) =>
  useQuery({ queryKey: keys.branches(id), queryFn: () => endpoints.branches(id), enabled })

export const useKeymapDoc = (id: number, path: string | undefined) =>
  useQuery({
    queryKey: keys.keymap(id, path ?? ""),
    queryFn: () => endpoints.keymap(id, path!),
    enabled: !!path,
    // The draft is the source of truth while editing; never clobber it
    // with a background refetch.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  })

export const useBuilds = (id: number, enabled: boolean, fast: boolean) =>
  useQuery({
    queryKey: keys.builds(id),
    queryFn: () => endpoints.builds(id),
    enabled,
    retry: false,
    refetchInterval: fast ? 10_000 : 60_000,
  })

export const useArtifacts = (id: number, run: number, enabled: boolean) =>
  useQuery({
    queryKey: keys.artifacts(id, run),
    queryFn: () => endpoints.artifacts(id, run),
    enabled,
    retry: false,
  })

export const useFirmware = (id: number, enabled: boolean) =>
  useQuery({ queryKey: keys.firmware(id), queryFn: () => endpoints.firmware(id), enabled })

export const useDevices = (enabled: boolean) =>
  useQuery({ queryKey: keys.devices, queryFn: endpoints.devices, enabled, refetchInterval: 3_000 })
