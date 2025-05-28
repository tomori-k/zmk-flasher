import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Repository } from '@/types/types'
import { toast } from 'sonner'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { PlusCircle, Trash } from 'lucide-react'

// RepositoryPanel Component
export interface RepositoryPanelProps {
  repositories: Repository[]
  selectedRepo: Repository | null
  setSelectedRepo: (repo: Repository | null) => void
  setRepoDialogOpen: (open: boolean) => void
  removeRepository?: (id: string) => void
}

export function RepositoryPanel({
  repositories,
  selectedRepo,
  setSelectedRepo,
  setRepoDialogOpen,
  removeRepository,
}: RepositoryPanelProps) {
  return (
    <div className="h-full flex flex-col border-b">
      <div className="p-4 border-b">
        <h3 className="font-semibold">② ファームウェアソース</h3>
      </div>

      <div className="p-4 flex-1">
        <div className="flex flex-col gap-4">
          {repositories.length > 0 ? (
            <>
              <Select
                value={selectedRepo?.id}
                onValueChange={(value) => {
                  const repo = repositories.find((r) => r.id === value)
                  setSelectedRepo(repo || null)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="リポジトリを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.id} value={repo.id}>
                      {repo.owner}/{repo.repo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedRepo && removeRepository && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 self-end"
                  onClick={() => {
                    toast.custom((t) => (
                      <div className="p-4 bg-card border rounded-lg shadow-lg">
                        <h3 className="font-medium mb-2">リポジトリの削除</h3>
                        <p className="text-sm mb-4">
                          {selectedRepo.owner}/{selectedRepo.repo}{' '}
                          を削除しますか？
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.dismiss(t)}
                          >
                            キャンセル
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              removeRepository(selectedRepo.id)
                              toast.dismiss(t)
                            }}
                          >
                            削除
                          </Button>
                        </div>
                      </div>
                    ))
                  }}
                >
                  <Trash className="h-4 w-4" />
                  リポジトリ削除
                </Button>
              )}
            </>
          ) : (
            <Alert>
              <AlertDescription>
                リポジトリが登録されていません。追加ボタンからリポジトリを登録してください。
              </AlertDescription>
            </Alert>
          )}

          <Button
            variant="outline"
            onClick={() => setRepoDialogOpen(true)}
            className="gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            リポジトリ追加
          </Button>
        </div>
      </div>
    </div>
  )
}
