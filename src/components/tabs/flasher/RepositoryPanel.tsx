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
import { getRepoDisplayName } from '@/lib/repoUtils'

// RepositoryPanel Component
export interface RepositoryPanelProps {
  repositories: Repository[]
  selectedRepo: string | null
  setSelectedRepo: (url: string | null) => void
  setRepoDialogOpen: (open: boolean) => void
  removeRepository?: (url: string) => void
  onRepositorySelected?: (url: string) => void
}

export function RepositoryPanel({
  repositories,
  selectedRepo,
  setSelectedRepo,
  setRepoDialogOpen,
  removeRepository,
  onRepositorySelected,
}: RepositoryPanelProps) {
  // リポジトリを選択したときの処理
  const handleRepoSelect = (url: string) => {
    setSelectedRepo(url)
    onRepositorySelected?.(url)
  }

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
                value={selectedRepo || ''}
                onValueChange={handleRepoSelect}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="リポジトリを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {repositories.map((repo) => (
                    <SelectItem key={repo.url} value={repo.url}>
                      {getRepoDisplayName(repo.url)}
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
                    const displayName = getRepoDisplayName(selectedRepo)
                    toast.custom((t) => (
                      <div className="p-4 bg-card border rounded-lg shadow-lg">
                        <h3 className="font-medium mb-2">リポジトリの削除</h3>
                        <p className="text-sm mb-4">
                          {displayName} を削除しますか？
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
                              removeRepository(selectedRepo)
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
