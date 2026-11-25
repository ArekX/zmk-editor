import { Settings02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { errorMessage } from "@/api/client"
import { endpoints } from "@/api/endpoints"
import { Spinner } from "@/components/common/Spinner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { keys, useSettings } from "@/hooks/queries"

const SOURCE_TEXT = {
  settings: "Using the token saved here.",
  gh: "Using your GitHub CLI login (gh auth token).",
  none: "No token. Build status of public repositories still works; downloading artifacts needs a token.",
}

export function SettingsDialog() {
  const qc = useQueryClient()
  const settings = useSettings()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState("")

  const save = useMutation({
    mutationFn: (value: string) => endpoints.saveSettings({ github_token: value }),
    onSuccess: (s) => {
      qc.setQueryData(keys.settings, s)
      qc.invalidateQueries({ queryKey: ["repo"] })
      setToken("")
      toast.success("Settings saved")
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  const s = settings.data
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Settings">
          <HugeiconsIcon icon={Settings02Icon} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Stored locally in {s?.data_dir ?? "the data directory"}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="gh-token">GitHub token</Label>
            <Input
              id="gh-token"
              type="password"
              autoComplete="off"
              placeholder={s?.github_token_set ? "A token is saved. Type to replace it." : "ghp_... or github_pat_..."}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {s ? SOURCE_TEXT[s.github_token_source] : ""} A fine-grained token with read access to Actions on
              your zmk-config repositories is enough. Git pull and push use your own git and SSH setup, not this
              token.
            </p>
          </div>
          <div className="text-muted-foreground grid gap-1 text-xs">
            <div>git: {s?.git_available ? "found" : "not found on PATH"}</div>
            <div>version: {s?.version}</div>
          </div>
        </div>
        <DialogFooter>
          {s?.github_token_set && (
            <Button variant="ghost" onClick={() => save.mutate("")} disabled={save.isPending}>
              Remove saved token
            </Button>
          )}
          <Button onClick={() => save.mutate(token)} disabled={!token.trim() || save.isPending}>
            {save.isPending && <Spinner />} Save token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
