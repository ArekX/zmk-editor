import { Download04Icon, FlashIcon, PackageIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { errorMessage } from "@/api/client"
import { endpoints, firmwareFileUrl, firmwareZipUrl } from "@/api/endpoints"
import type { Artifact, BuildRun, Device, FirmwareDownload } from "@/api/types"
import { Spinner } from "@/components/common/Spinner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { keys } from "@/hooks/queries"
import { formatBytes } from "@/lib/format"

export function ArtifactRow({
  repoId,
  run,
  artifact,
  cached,
  devices,
}: {
  repoId: number
  run: BuildRun
  artifact: Artifact
  cached: FirmwareDownload | undefined
  devices: Device[]
}) {
  const qc = useQueryClient()
  const download = useMutation({
    mutationFn: () =>
      endpoints.downloadFirmware(repoId, {
        artifact_id: artifact.id,
        run_id: run.id,
        name: artifact.name,
        head_sha: run.head_sha,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.firmware(repoId) }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const flash = useMutation({
    mutationFn: (v: { file: string; device: string }) => endpoints.flash(repoId, cached!.id, v.file, v.device),
    onSuccess: (r) => toast.success(`Flashed to ${r.device}. The keyboard restarts on its own.`),
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="bg-background/60 grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm">
        <HugeiconsIcon icon={PackageIcon} className="text-muted-foreground size-4" />
        <span className="min-w-0 flex-1 truncate font-medium">{artifact.name}</span>
        <span className="text-muted-foreground text-xs">{formatBytes(artifact.size_in_bytes)}</span>
        {artifact.expired ? (
          <span className="text-muted-foreground text-xs">expired</span>
        ) : cached ? (
          <Button size="xs" variant="ghost" asChild>
            <a href={firmwareZipUrl(repoId, cached.id)}>
              <HugeiconsIcon icon={Download04Icon} /> zip
            </a>
          </Button>
        ) : (
          <Button size="xs" disabled={download.isPending} onClick={() => download.mutate()}>
            {download.isPending ? <Spinner className="size-3" /> : <HugeiconsIcon icon={Download04Icon} />}
            Download
          </Button>
        )}
      </div>
      {cached && (
        <div className="grid gap-1">
          {cached.files.map((f) => (
            <div key={f.name} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-mono">{f.name}</span>
              <span className="text-muted-foreground">{formatBytes(f.size)}</span>
              <Button size="xs" variant="outline" asChild>
                <a href={firmwareFileUrl(repoId, cached.id, f.name)}>
                  <HugeiconsIcon icon={Download04Icon} /> Save
                </a>
              </Button>
              {f.name.toLowerCase().endsWith(".uf2") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="xs" variant="secondary" disabled={flash.isPending}>
                      {flash.isPending ? <Spinner className="size-3" /> : <HugeiconsIcon icon={FlashIcon} />} Flash
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Copy to bootloader drive</DropdownMenuLabel>
                    {devices.length === 0 && (
                      <div className="text-muted-foreground px-2 py-1.5 text-xs">
                        No UF2 drive found. Double-tap reset on the keyboard half to enter the bootloader.
                      </div>
                    )}
                    {devices.map((d) => (
                      <DropdownMenuItem key={d.path} onSelect={() => flash.mutate({ file: f.name, device: d.path })}>
                        <span className="font-medium">{d.name}</span>
                        <span className="text-muted-foreground ml-auto text-xs">{d.board_id || d.model}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
