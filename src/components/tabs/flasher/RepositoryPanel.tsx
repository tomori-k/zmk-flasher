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
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()

  // リポジトリを選択したときの処理
  const handleRepoSelect = (url: string) => {
    setSelectedRepo(url)
    onRepositorySelected?.(url)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold">
          ② {t('flasher.repositoryPanel.title')}
        </h3>
      </div>

      <ScrollArea className="flex-1 h-full">
        <div className="p-4">
          <div className="flex flex-col gap-4">
            {repositories.length > 0 ? (
              <>
                <Select
                  value={selectedRepo || ''}
                  onValueChange={handleRepoSelect}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t('flasher.repositoryPanel.select')}
                    />
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
                      toast.custom((toastId) => (
                        <div className="p-4 bg-card border rounded-lg shadow-lg">
                          <h3 className="font-medium mb-2">
                            {t('flasher.dialog.repository.title')}
                          </h3>
                          <p className="text-sm mb-4">
                            {displayName} を削除しますか？
                          </p>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toast.dismiss(toastId)}
                            >
                              {t('flasher.dialog.repository.cancel')}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                removeRepository(selectedRepo)
                                toast.dismiss(toastId)
                              }}
                            >
                              {t('flasher.dialog.repository.add')}
                            </Button>
                          </div>
                        </div>
                      ))
                    }}
                  >
                    <Trash className="h-4 w-4" />
                    {t('flasher.repositoryPanel.addRepo')}
                  </Button>
                )}
              </>
            ) : (
              <Alert>
                <AlertDescription>
                  {t('flasher.repositoryPanel.noRepos')}
                </AlertDescription>
              </Alert>
            )}

            <Button
              variant="outline"
              onClick={() => setRepoDialogOpen(true)}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              {t('flasher.repositoryPanel.addRepo')}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
