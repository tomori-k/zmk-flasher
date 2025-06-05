import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Device, Repository, Firmware, Workflow } from '@/types/types'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { useState } from 'react'
import { toast } from 'sonner'
import { useLifetimeAbort } from '@/hooks/use-lifetime-abort'
import { apiClient } from '@/services/apiClientFactory'
import { useRepositoriesStore } from '@/stores/repositories'
import { useTranslation } from 'react-i18next'

// FirmwarePanel Component
export interface FirmwarePanelProps {
  selectedDevice: Device | null
  selectedRepo: string | null
  firmwares: Firmware[]
  selectedFirmware: Firmware | null
  setSelectedFirmware: (firmware: Firmware | null) => void
  isLoadingFirmwares: boolean
  isCompatible: boolean | null
  onRefreshFirmwares?: (firmwares: Firmware[]) => void
  // selectedWorkflowを削除し、ワークフローIDを設定する関数に変更
  setSelectedWorkflowId: (workflowId: number | null) => void
  workflows: Workflow[]
  isLoadingWorkflows: boolean
}

// GitHubのAPIを使って最新の複数の成功したActionsのartifactsを取得する関数
interface GitHubArtifact {
  id: number
  name: string
  archive_download_url: string
  created_at: string
  size_in_bytes: number
}
interface GitHubWorkflowRun {
  id: number
  head_branch: string
  head_commit?: { message?: string }
}
const fetchLatestFirmware = async (
  repositoryUrl: string,
  workflowId: number | null,
  signal: AbortSignal,
  runsCount: number = 3 // 取得するワークフローランの数（デフォルトは3つ）
): Promise<Firmware[]> => {
  if (!repositoryUrl) {
    throw new Error('リポジトリが選択されていません')
  }

  if (!workflowId) {
    throw new Error('ワークフローが選択されていません')
  }

  // リポジトリオブジェクトを作成
  const repository: Repository = { url: repositoryUrl }

  // 指定されたワークフローの最新の成功したランを複数取得
  const workflowRuns = (await apiClient.fetchWorkflowRuns(
    repository,
    workflowId,
    signal,
    1, // ページ番号
    runsCount // 取得する数
  )) as GitHubWorkflowRun[]

  if (workflowRuns.length === 0) {
    throw new Error(
      '成功したファームウェアビルドのワークフローが見つかりません'
    )
  }

  // 複数のワークフローランからartifactsを取得して結合
  const firmwares: Firmware[] = []

  for (const run of workflowRuns) {
    const artifacts = (await apiClient.fetchWorkflowRunsArtifacts(
      repository,
      run.id,
      signal
    )) as GitHubArtifact[]

    if (artifacts.length > 0) {
      // コミットメッセージを取得
      const commitMessage = run.head_commit?.message || 'コミットメッセージなし'

      // このランのartifactsをFirmwareオブジェクトに変換
      const runFirmwares = artifacts.map((artifact: GitHubArtifact) => ({
        id: `github-artifact-${artifact.id}`,
        name: artifact.name,
        path: artifact.archive_download_url,
        buildDate: artifact.created_at,
        branch: run.head_branch || 'unknown',
        commitMessage,
        size: artifact.size_in_bytes,
        // Note: boardIdとfamilyIdはartifact名から推測するか、
        // メタデータが利用可能であれば追加する必要があります
      }))

      // 結果配列に追加
      firmwares.push(...runFirmwares)
    }
  }

  if (firmwares.length === 0) {
    throw new Error('Artifactsが見つかりません')
  }

  return firmwares
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
  setSelectedWorkflowId,
  workflows,
  isLoadingWorkflows,
}: FirmwarePanelProps) {
  const { t } = useTranslation()
  const [isLoadingLatestFirmwares, setIsLoadingLatestFirmwares] =
    useState(false)

  // リポジトリストアからselectedWorkflowを取得
  const { getSelectedWorkflow } = useRepositoriesStore()
  // 現在選択されているワークフロー
  const selectedWorkflow = getSelectedWorkflow()

  const refLifetimeAbort = useLifetimeAbort()

  // 最新のファームウェアを取得するハンドラー
  const handleGetLatest = async () => {
    if (refLifetimeAbort.current == null) {
      return
    }
    if (!selectedRepo) {
      toast.error(t('flasher.toast.error'))
      return
    }

    if (!selectedWorkflow) {
      toast.error(t('flasher.toast.error'))
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
          t('flasher.toast.newFirmware', { count: newFirmwares.length })
        )
      } else {
        toast.info(t('flasher.toast.noNewFirmware'))
      }
    } catch (error) {
      // エラーメッセージを表示
      toast.error(t('flasher.toast.flashFailed'), {
        description:
          error instanceof Error ? error.message : t('flasher.toast.error'),
        duration: 5000,
      })
    } finally {
      setIsLoadingLatestFirmwares(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold">③ {t('flasher.firmwarePanel.title')}</h3>
      </div>

      <ScrollArea className="flex-1 h-full pb-16">
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
                  <h4 className="text-sm font-medium">
                    {t('flasher.firmwarePanel.selectWorkflow')}
                  </h4>
                  {isLoadingWorkflows && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>

                <Select
                  value={selectedWorkflow?.id?.toString()}
                  onValueChange={(value) => {
                    // ワークフローIDだけを親コンポーネントに渡す
                    setSelectedWorkflowId(parseInt(value))
                  }}
                  disabled={isLoadingWorkflows || workflows.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t('flasher.firmwarePanel.selectWorkflow')}
                    />
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
                  <h4 className="text-sm font-medium">
                    {t('flasher.firmwarePanel.selectFirmware')}
                  </h4>
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
                    {t('flasher.firmwarePanel.refresh')}
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
                        <SelectValue
                          placeholder={t(
                            'flasher.firmwarePanel.selectFirmware'
                          )}
                        />
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
                        <h4 className="font-medium">
                          ④ {t('flasher.firmwarePanel.details')}
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              BoardID
                            </p>
                            <p>
                              {selectedFirmware.boardId ||
                                t('flasher.firmwarePanel.none')}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              FamilyID
                            </p>
                            <p>
                              {selectedFirmware.familyId ||
                                t('flasher.firmwarePanel.none')}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {t('flasher.firmwarePanel.size')}
                            </p>
                            <p>{Math.round(selectedFirmware.size / 1024)} KB</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {t('flasher.firmwarePanel.buildDate')}
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
                                {t('flasher.firmwarePanel.commitMessage')}
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
                                <AlertTitle>
                                  {t(
                                    'flasher.firmwarePanel.compatibilityCheck'
                                  )}
                                  : OK
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    'flasher.firmwarePanel.compatibility.compatible'
                                  )}
                                </AlertDescription>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>
                                  {t(
                                    'flasher.firmwarePanel.compatibilityCheck'
                                  )}
                                  : NG
                                </AlertTitle>
                                <AlertDescription>
                                  {t(
                                    'flasher.firmwarePanel.compatibility.incompatible'
                                  )}
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
                              {t('flasher.firmwarePanel.downloadArtifact')}
                            </Button>
                          )}
                      </div>
                    )}
                  </>
                ) : (
                  <Alert>
                    <AlertDescription>
                      {t('flasher.firmwarePanel.noFirmware')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )
          ) : (
            <Alert>
              <AlertDescription>
                {t('flasher.firmwarePanel.selectDeviceAndRepo')}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
