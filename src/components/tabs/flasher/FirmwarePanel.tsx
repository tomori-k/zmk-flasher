import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Device, Repository, Firmware, Workflow } from '@/types/types'
import { ScrollArea } from '@radix-ui/react-scroll-area'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useLifetimeAbort } from '@/hooks/use-lifetime-abort'
import { apiClient } from '@/services/apiClientFactory'

// FirmwarePanel Component
export interface FirmwarePanelProps {
  selectedDevice: Device | null
  selectedRepo: Repository | null
  firmwares: Firmware[]
  selectedFirmware: Firmware | null
  setSelectedFirmware: (firmware: Firmware | null) => void
  isLoadingFirmwares: boolean
  isCompatible: boolean | null
  onRefreshFirmwares?: (firmwares: Firmware[]) => void
  selectedWorkflow?: any | null
  setSelectedWorkflow?: (workflow: any | null) => void
}

// GitHubのAPIを使って最新の成功したActionsのartifactsを取得する関数
const fetchLatestFirmware = async (
  repository: Repository,
  workflowId: number | null,
  signal: AbortSignal
): Promise<Firmware[]> => {
  if (!repository) {
    throw new Error('リポジトリが選択されていません')
  }

  if (!workflowId) {
    throw new Error('ワークフローが選択されていません')
  }

  // 特定のワークフローの最新の成功したランを取得
  const workflowRuns = await apiClient.fetchWorkflowRuns(
    repository,
    workflowId,
    signal,
    1,
    1
  )

  if (workflowRuns.length === 0) {
    throw new Error(
      '成功したファームウェアビルドのワークフローが見つかりません'
    )
  }

  // 最新のワークフローランからartifactsを取得
  const latestRunId = workflowRuns[0].id
  const artifacts = await apiClient.fetchWorkflowRunsArtifacts(
    repository,
    latestRunId,
    signal
  )

  if (artifacts.length === 0) {
    throw new Error('Artifactsが見つかりません')
  }

  // コミットメッセージを取得
  const commitMessage =
    workflowRuns[0].head_commit?.message || 'コミットメッセージなし'

  // artifactsをFirmwareオブジェクトに変換
  return artifacts.map((artifact: any) => ({
    id: `github-artifact-${artifact.id}`,
    name: artifact.name,
    path: artifact.archive_download_url,
    buildDate: artifact.created_at,
    branch: workflowRuns[0].head_branch || 'unknown',
    commitMessage,
    size: artifact.size_in_bytes,
    // Note: boardIdとfamilyIdはartifact名から推測するか、
    // メタデータが利用可能であれば追加する必要があります
  }))
}

export default function FirmwarePanel({
  selectedDevice,
  selectedRepo,
  firmwares,
  selectedFirmware,
  setSelectedFirmware,
  isLoadingFirmwares,
  isCompatible,
  onRefreshFirmwares,
  selectedWorkflow,
  setSelectedWorkflow,
}: FirmwarePanelProps) {
  const [isLoadingLatestFirmwares, setIsLoadingLatestFirmwares] =
    useState(false)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false)

  const refLifetimeAbort = useLifetimeAbort()

  // リポジトリが変更されたときにワークフローを取得する
  useEffect(() => {
    if (!selectedRepo) return

    console.log(selectedRepo)

    const abort = new AbortController()

    const fetchRepositoryWorkflows = async () => {
      setIsLoadingWorkflows(true)
      try {
        const workflowList = await apiClient.fetchWorkflows(
          selectedRepo,
          abort.signal
        )
        setWorkflows(workflowList)

        // リポジトリに保存されたワークフローIDがあればそれを選択
        if (selectedRepo.workflowId) {
          const savedWorkflow = workflowList.find(
            (w) => w.id === selectedRepo.workflowId
          )
          if (savedWorkflow && setSelectedWorkflow) {
            setSelectedWorkflow(savedWorkflow)
          }
        }
        // ワークフローが1つ以上あり、まだ選択されていなければ最初のものを選択
        else if (
          workflowList.length > 0 &&
          setSelectedWorkflow &&
          !selectedWorkflow
        ) {
          setSelectedWorkflow(workflowList[0])
        }
      } catch (error) {
        toast.error('ワークフローの取得に失敗しました', {
          description:
            error instanceof Error
              ? error.message
              : '不明なエラーが発生しました',
          duration: 5000,
        })
      } finally {
        setIsLoadingWorkflows(false)
      }
    }

    fetchRepositoryWorkflows()

    return () => {
      abort.abort()
    }
  }, [selectedRepo])

  // 最新のファームウェアを取得するハンドラー
  const handleGetLatest = async () => {
    if (refLifetimeAbort.current == null) {
      return
    }
    if (!selectedRepo) {
      toast.error('リポジトリが選択されていません')
      return
    }

    if (!selectedWorkflow) {
      toast.error('ワークフローが選択されていません')
      return
    }

    setIsLoadingLatestFirmwares(true)

    try {
      const newFirmwares = await fetchLatestFirmware(
        selectedRepo,
        selectedWorkflow.id,
        refLifetimeAbort.current.signal
      )

      // 親コンポーネントにファームウェアリストを更新
      if (onRefreshFirmwares) {
        onRefreshFirmwares(newFirmwares)
      }

      // 成功メッセージを表示
      if (newFirmwares.length > 0) {
        toast.success(
          `${newFirmwares.length}個の最新ファームウェアを取得しました`
        )
      } else {
        toast.info('新しいファームウェアはありませんでした')
      }
    } catch (error) {
      // エラーメッセージを表示
      toast.error('ファームウェアの取得に失敗しました', {
        description:
          error instanceof Error ? error.message : '不明なエラーが発生しました',
        duration: 5000,
      })
    } finally {
      setIsLoadingLatestFirmwares(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold">③ ファームウェア一覧</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {selectedDevice && selectedRepo ? (
            isLoadingFirmwares ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* ワークフロー選択セクションを追加 */}
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">ワークフロー選択</h4>
                  {isLoadingWorkflows && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>

                <Select
                  value={selectedWorkflow?.id?.toString()}
                  onValueChange={(value) => {
                    const workflow = workflows.find(
                      (w) => w.id === parseInt(value)
                    )
                    if (setSelectedWorkflow) {
                      setSelectedWorkflow(workflow || null)
                    }
                  }}
                  disabled={isLoadingWorkflows || workflows.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="ワークフローを選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((workflow) => (
                      <SelectItem
                        key={workflow.id}
                        value={workflow.id.toString()}
                      >
                        {workflow.name} ({workflow.path})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">ファームウェア選択</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGetLatest}
                    disabled={isLoadingLatestFirmwares || !selectedWorkflow}
                  >
                    {isLoadingLatestFirmwares ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    最新のファームウェアを取得
                  </Button>
                </div>

                {firmwares.length > 0 ? (
                  <>
                    <Select
                      value={selectedFirmware?.id}
                      onValueChange={(value) => {
                        const firmware = firmwares.find((f) => f.id === value)
                        setSelectedFirmware(firmware || null)
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="ファームウェアを選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        {firmwares.map((firmware) => (
                          <SelectItem key={firmware.id} value={firmware.id}>
                            {firmware.name} (
                            {new Date(firmware.buildDate).toLocaleDateString()}{' '}
                            - {firmware.branch})
                            {firmware.commitMessage && (
                              <div className="text-xs text-muted-foreground mt-1 truncate max-w-[400px]">
                                {firmware.commitMessage}
                              </div>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedFirmware && (
                      <div className="mt-6 space-y-4">
                        <h4 className="font-medium">④ 詳細／互換チェック</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              BoardID
                            </p>
                            <p>{selectedFirmware.boardId || 'なし'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              FamilyID
                            </p>
                            <p>{selectedFirmware.familyId || 'なし'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              サイズ
                            </p>
                            <p>{Math.round(selectedFirmware.size / 1024)} KB</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              ビルド日時
                            </p>
                            <p>
                              {new Date(
                                selectedFirmware.buildDate
                              ).toLocaleString()}
                            </p>
                          </div>
                          {selectedFirmware.commitMessage && (
                            <div className="col-span-2">
                              <p className="text-sm text-muted-foreground">
                                コミットメッセージ
                              </p>
                              <p className="break-words">
                                {selectedFirmware.commitMessage}
                              </p>
                            </div>
                          )}
                        </div>

                        {isCompatible !== null && (
                          <Alert
                            variant={isCompatible ? 'default' : 'destructive'}
                          >
                            {isCompatible ? (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertTitle>互換性チェック: OK</AlertTitle>
                                <AlertDescription>
                                  選択したファームウェアはこのデバイスと互換性があります。
                                </AlertDescription>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>互換性チェック: NG</AlertTitle>
                                <AlertDescription>
                                  選択したファームウェアはこのデバイスと互換性がありません。別のファームウェアを選択してください。
                                </AlertDescription>
                              </>
                            )}
                          </Alert>
                        )}

                        {selectedFirmware.path &&
                          selectedFirmware.id.includes('github-artifact') && (
                            <Button
                              className="w-full"
                              onClick={() =>
                                window.open(selectedFirmware?.path, '_blank')
                              }
                            >
                              <Download className="h-4 w-4 mr-2" />
                              アーティファクトをダウンロード
                            </Button>
                          )}
                      </div>
                    )}
                  </>
                ) : (
                  <Alert>
                    <AlertDescription>
                      該当するファームウェアが見つかりません。「最新のファームウェアを取得」ボタンをクリックするか、別のデバイスまたはリポジトリを選択してください。
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )
          ) : (
            <Alert>
              <AlertDescription>
                デバイスとリポジトリを選択するとファームウェア一覧が表示されます。
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
