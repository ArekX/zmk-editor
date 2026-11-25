import { GitBranchIcon } from "@hugeicons/core-free-icons"

import { EmptyState, ErrorState, LoadingState } from "@/components/common/States"
import { AddRepoDialog } from "@/components/repos/AddRepoDialog"
import { RepoCard } from "@/components/repos/RepoCard"
import { TopBar } from "@/components/shell/TopBar"
import { useRepos } from "@/hooks/queries"

export function HomePage() {
  const repos = useRepos()
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar actions={repos.data?.length ? <AddRepoDialog /> : null} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Repositories</h1>
          <p className="text-muted-foreground mt-1">
            Your zmk-config repositories. Edit keymaps, commit and push, then grab the firmware GitHub built.
          </p>
        </div>
        {repos.isLoading && <LoadingState />}
        {repos.error && <ErrorState error={repos.error} />}
        {repos.data?.length === 0 && (
          <div className="rounded-2xl border border-dashed">
            <EmptyState icon={GitBranchIcon} title="No repositories yet" action={<AddRepoDialog />}>
              Clone your zmk-config over SSH or HTTPS, or point the editor at a checkout you already have.
            </EmptyState>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.data?.map((r) => <RepoCard key={r.id} repo={r} />)}
        </div>
      </main>
    </div>
  )
}
