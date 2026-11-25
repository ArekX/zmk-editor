import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { ApiError, errorMessage } from "@/api/client"
import { endpoints } from "@/api/endpoints"
import type { Keymap, KeymapDocument } from "@/api/types"
import { keys } from "@/hooks/queries"

/** Writes the draft back to the file and swaps in the re-parsed document. */
export function useSaveKeymap(repoId: number, doc: KeymapDocument | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (keymap: Keymap) => endpoints.saveKeymap(repoId, doc!.path, doc!.hash, keymap),
    onSuccess: (next) => {
      qc.setQueryData(keys.keymap(repoId, next.path), next)
      qc.invalidateQueries({ queryKey: keys.repo(repoId) })
      toast.success("Saved to the working tree")
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "conflict") {
        toast.error(err.message, {
          action: {
            label: "Reload",
            onClick: () => qc.invalidateQueries({ queryKey: keys.keymap(repoId, doc!.path) }),
          },
          duration: 15000,
        })
        return
      }
      toast.error(errorMessage(err))
    },
  })
}
