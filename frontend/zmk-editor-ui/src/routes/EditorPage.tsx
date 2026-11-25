import { Alert02Icon, File01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router"

import { BehaviorsPanel } from "@/components/behaviors/BehaviorsPanel"
import { ChangesPanel } from "@/components/changes/ChangesPanel"
import { CombosPanel } from "@/components/combos/CombosPanel"
import { EmptyState, ErrorState, LoadingState } from "@/components/common/States"
import { EditorActions, EditorBreadcrumb } from "@/components/editor/EditorHeader"
import { LayoutDialog } from "@/components/editor/LayoutDialog"
import { PullPromptDialog } from "@/components/editor/PullPromptDialog"
import { FirmwareSheet } from "@/components/firmware/FirmwareSheet"
import { LayersPanel } from "@/components/keyboard/LayersPanel"
import { TopBar } from "@/components/shell/TopBar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { keys, useKeymapDoc, useRepo, useStatus } from "@/hooks/queries"
import { useEditorShortcuts, useUnloadWarning } from "@/hooks/useEditorShortcuts"
import { useGitActions } from "@/hooks/useGitActions"
import { useKeymapDraft } from "@/hooks/useKeymapDraft"
import { useRemoteCheck } from "@/hooks/useRemoteCheck"
import { useSaveKeymap } from "@/hooks/useSaveKeymap"
import { useCatalog } from "@/hooks/useZmkData"

type Tab = "layers" | "combos" | "behaviors" | "changes"

export function EditorPage() {
  const id = Number(useParams().id)
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const repo = useRepo(id)
  const status = useStatus(id)
  const keymapPath = params.get("keymap") ?? (repo.data?.default_keymap || repo.data?.keymaps?.[0])
  const doc = useKeymapDoc(id, keymapPath)
  const draft = useKeymapDraft(doc.data)
  const catalog = useCatalog(draft.keymap)
  const save = useSaveKeymap(id, doc.data)
  const git = useGitActions(id, () => {
    if (keymapPath) qc.invalidateQueries({ queryKey: keys.keymap(id, keymapPath) })
  })
  const [firmwareOpen, setFirmwareOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [warningsHidden, setWarningsHidden] = useState(false)
  const [warningsOpen, setWarningsOpen] = useState(false)
  const remote = useRemoteCheck(id)
  // The prompt shows once per check result; "Not now" hides it until the
  // repository is opened again.
  const [dismissedCheck, setDismissedCheck] = useState(0)
  const pullPromptOpen = !!remote.data && remote.data.status.behind > 0 && dismissedCheck !== remote.dataUpdatedAt

  const tab = (params.get("tab") as Tab) ?? "layers"
  const activeLayer = Number(params.get("layer") ?? 0)
  const patchParams = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const doSave = useCallback(() => {
    if (draft.dirty && draft.keymap && !save.isPending) save.mutate(draft.keymap)
  }, [draft.dirty, draft.keymap, save])
  const shortcuts = useMemo(
    () => ({ save: doSave, undo: draft.undo, redo: draft.redo }),
    [doSave, draft.undo, draft.redo],
  )
  useEditorShortcuts(shortcuts)
  useUnloadWarning(draft.dirty)

  if (repo.isLoading) return <LoadingState className="min-h-screen" />
  if (repo.error || !repo.data) return <ErrorState error={repo.error ?? "Repository not found"} />

  const changedFiles = status.data?.files.length ?? 0
  const warnings = [...(doc.data?.keymap.warnings ?? [])]

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        actions={
          <EditorActions
            repo={repo.data}
            status={status.data}
            draft={draft}
            git={git}
            saving={save.isPending}
            onSave={doSave}
            onOpenFirmware={() => setFirmwareOpen(true)}
            onOpenLayout={() => setLayoutOpen(true)}
          />
        }
      >
        <EditorBreadcrumb
          repo={repo.data}
          keymapPath={keymapPath}
          onKeymap={(k) => patchParams({ keymap: k, layer: null })}
          status={status.data}
          git={git}
          dirty={draft.dirty}
        />
      </TopBar>

      <div className="flex h-12 shrink-0 items-center gap-4 border-b px-4">
        <Tabs value={tab} onValueChange={(v) => patchParams({ tab: v === "layers" ? null : v })}>
          <TabsList>
            <TabsTrigger value="layers">Layers</TabsTrigger>
            <TabsTrigger value="combos">
              Combos
              {draft.keymap && <span className="text-muted-foreground text-xs">{draft.keymap.combos.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="behaviors">Behaviors</TabsTrigger>
            <TabsTrigger value="changes">
              Changes
              {changedFiles > 0 && (
                <span className="bg-warning/20 text-warning rounded-full px-1.5 text-[10px]">{changedFiles}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {draft.dirty && (
          <span className="text-warning flex items-center gap-1.5 text-xs">
            <span className="bg-warning size-1.5 rounded-full" /> Unsaved edits
          </span>
        )}
        {keymapPath && <span className="text-muted-foreground ml-auto font-mono text-xs">{keymapPath}</span>}
      </div>

      {warnings.length > 0 && !warningsHidden && tab !== "changes" && (
        <div className="bg-warning/10 text-warning border-b px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Alert02Icon} className="size-3.5 shrink-0" />
            <span className="flex-1">
              {warnings.length} part{warnings.length === 1 ? "" : "s"} of this keymap could not be read and{" "}
              {warnings.length === 1 ? "is" : "are"} left untouched.
            </span>
            <button className="underline" onClick={() => setWarningsOpen((o) => !o)}>
              {warningsOpen ? "Less" : "Details"}
            </button>
            <button className="underline" onClick={() => setWarningsHidden(true)}>
              Hide
            </button>
          </div>
          {warningsOpen && (
            <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-9 font-mono text-[11px]">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === "changes" ? (
          <ChangesPanel repoId={id} status={status.data} git={git} unsaved={draft.dirty} />
        ) : !keymapPath ? (
          <EmptyState icon={File01Icon} title="No keymap found">
            This repository has no .keymap file. ZMK configs keep it under config/.
          </EmptyState>
        ) : doc.isLoading || (draft.keymap && !catalog) ? (
          <LoadingState label="Loading keymap" />
        ) : doc.error ? (
          <div className="p-6">
            <ErrorState error={doc.error} />
          </div>
        ) : doc.data && draft.keymap?.layers.length === 0 ? (
          <EmptyState icon={File01Icon} title="No editable layers in this keymap">
            The editor reads layers written as devicetree nodes inside the zmk,keymap node. This file defines them
            another way, most likely through preprocessor macros such as ZMK_LAYER, which are left as they are.
          </EmptyState>
        ) : doc.data && draft.keymap && catalog ? (
          tab === "combos" ? (
            <CombosPanel doc={doc.data} keymap={draft.keymap} catalog={catalog} update={draft.update} />
          ) : tab === "behaviors" ? (
            <BehaviorsPanel doc={doc.data} keymap={draft.keymap} catalog={catalog} update={draft.update} />
          ) : (
            <LayersPanel
              doc={doc.data}
              keymap={draft.keymap}
              catalog={catalog}
              update={draft.update}
              activeLayer={activeLayer}
              setActiveLayer={(i) => patchParams({ layer: i ? String(i) : null })}
            />
          )
        ) : null}
      </main>

      {remote.data && (
        <PullPromptDialog
          check={remote.data}
          open={pullPromptOpen}
          onOpenChange={(o) => !o && setDismissedCheck(remote.dataUpdatedAt)}
          git={git}
          dirty={draft.dirty}
        />
      )}
      <FirmwareSheet repo={repo.data} open={firmwareOpen} onOpenChange={setFirmwareOpen} />
      {doc.data && <LayoutDialog repoId={id} doc={doc.data} open={layoutOpen} onOpenChange={setLayoutOpen} />}
    </div>
  )
}
