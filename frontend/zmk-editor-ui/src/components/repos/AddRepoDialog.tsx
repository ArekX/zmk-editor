import { Add01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { keys } from "@/hooks/queries"

export function AddRepoDialog({ trigger }: { trigger?: React.ReactNode }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"clone" | "local">("clone")
  const [url, setUrl] = useState("")
  const [branch, setBranch] = useState("")
  const [path, setPath] = useState("")
  const [name, setName] = useState("")

  const add = useMutation({
    mutationFn: () =>
      endpoints.addRepo(mode === "clone" ? { url, branch, name } : { path, name }),
    onSuccess: (repo) => {
      qc.invalidateQueries({ queryKey: keys.repos })
      setOpen(false)
      setUrl("")
      setPath("")
      setName("")
      setBranch("")
      navigate(`/repos/${repo.id}`)
    },
  })

  const valid = mode === "clone" ? url.trim() !== "" : path.trim() !== ""

  return (
    <Dialog open={open} onOpenChange={(o) => !add.isPending && setOpen(o)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <HugeiconsIcon icon={Add01Icon} /> Add repository
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) add.mutate()
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a zmk-config repository</DialogTitle>
            <DialogDescription>
              Git runs with your own SSH keys and credentials, so private repositories work the same as on the
              command line.
            </DialogDescription>
          </DialogHeader>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "clone" | "local")}>
            <TabsList className="w-full">
              <TabsTrigger value="clone">Clone from URL</TabsTrigger>
              <TabsTrigger value="local">Use a local folder</TabsTrigger>
            </TabsList>
            <TabsContent value="clone" className="grid gap-3 pt-3">
              <div className="grid gap-1.5">
                <Label htmlFor="repo-url">Clone URL</Label>
                <Input
                  id="repo-url"
                  autoFocus
                  placeholder="git@github.com:you/zmk-config.git"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="repo-branch">Branch (optional)</Label>
                <Input id="repo-branch" placeholder="default branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
              </div>
            </TabsContent>
            <TabsContent value="local" className="grid gap-3 pt-3">
              <div className="grid gap-1.5">
                <Label htmlFor="repo-path">Folder</Label>
                <Input
                  id="repo-path"
                  placeholder="~/code/zmk-config"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">An existing git checkout. It is used in place, never moved or deleted.</p>
              </div>
            </TabsContent>
          </Tabs>
          <div className="grid gap-1.5">
            <Label htmlFor="repo-name">Display name (optional)</Label>
            <Input id="repo-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {add.error && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-xs whitespace-pre-wrap">
              {errorMessage(add.error)}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!valid || add.isPending}>
              {add.isPending && <Spinner />}
              {mode === "clone" ? (add.isPending ? "Cloning" : "Clone") : "Add folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
