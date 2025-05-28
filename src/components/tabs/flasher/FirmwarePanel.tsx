import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Device, Repository, Firmware } from '@/types/types'
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
import { useState } from 'react'
import { toast } from 'sonner'
import { useLifetimeAbort } from '@/hooks/use-lifetime-abort'

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
}

async function fetchWorkflows(
  repository: Repository,
  signal: AbortSignal,
  page: number = 1,
  perPage: number = 10
): Promise<any[]> {
  const response = await fetch(
    `https://api.github.com/repos/${repository.owner}/${repository.repo}/actions/workflows?per_page=${perPage}&page=${page}`,
    { signal }
  )
  if (!response.ok) {
    throw new Error(
      `ワークフローの取得に失敗しました (${
        response.status
      }): ${await response.text()}`
    )
  }
  // TODO: Zod で API レスポンスの検証をしたい&帰値の型付けしたい。
  const data = await response.json()
  return data.workflows || []
}

async function fetchWorkflowRuns(
  repository: Repository,
  workflowId: number,
  signal: AbortSignal,
  page: number = 1,
  perPage: number = 10
): Promise<any[]> {
  const response = await fetch(
    `https://api.github.com/repos/${repository.owner}/${repository.repo}/actions/workflows/${workflowId}/runs?per_page=${perPage}&page=${page}`,
    { signal }
  )
  if (!response.ok) {
    throw new Error(
      `ワークフローランの取得に失敗しました (${
        response.status
      }): ${await response.text()}`
    )
  }
  const data = await response.json()
  return data.workflow_runs || []
}

async function fetchWorkflowRunsArifacts(
  repository: Repository,
  workflowRunId: number,
  signal: AbortSignal
): Promise<any[]> {
  const response = await fetch(
    `https://api.github.com/repos/${repository.owner}/${repository.repo}/actions/runs/${workflowRunId}/artifacts`,
    { signal }
  )
  if (!response.ok) {
    throw new Error(
      `Artifactsの取得に失敗しました (${
        response.status
      }): ${await response.text()}`
    )
  }
  const data = await response.json()
  return data.artifacts || []
}

// GitHubのAPIを使って最新の成功したActionsのartifactsを取得する関数
const fetchLatestFirmware = async (
  repository: Repository,
  signal: AbortSignal
): Promise<Firmware[]> => {
  if (!repository) {
    throw new Error('リポジトリが選択されていません')
  }

  // "Build ZMK firmware" という名前のワークフローを探す
  // 最初の10件でなかったらエラーを投げる
  const PerPage = 10
  const workflows = await fetchWorkflows(repository, signal, 1, PerPage)

  const firmwareBuildWorkflow = workflows.find(
    (workflow: any) => workflow.name === 'Build ZMK firmware'
  )

  // 見つかった場合はループを抜ける
  if (firmwareBuildWorkflow == null) {
    throw new Error(
      '"Build ZMK firmware" という名前のワークフローが見つかりません'
    )
  }

  // 特定のワークフローの最新の成功したランを取得

  const workflowRuns = await fetchWorkflowRuns(
    repository,
    firmwareBuildWorkflow.id,
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
  const artifacts = await fetchWorkflowRunsArifacts(
    repository,
    latestRunId,
    signal
  )

  if (artifacts.length === 0) {
    throw new Error('Artifactsが見つかりません')
  }

  // artifactsをFirmwareオブジェクトに変換
  return artifacts.map((artifact: any) => ({
    id: `github-artifact-${artifact.id}`,
    name: artifact.name,
    path: artifact.archive_download_url,
    buildDate: artifact.created_at,
    branch: workflowRuns[0].head_branch || 'unknown',
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
}: FirmwarePanelProps) {
  const [isLoadingLatestFirmwares, setIsLoadingLatestFirmwares] =
    useState(false)

  const refLifetimeAbort = useLifetimeAbort()

  // 最新のファームウェアを取得するハンドラー
  const handleGetLatest = async () => {
    if (refLifetimeAbort.current == null) {
      return
    }
    if (!selectedRepo) {
      toast.error('リポジトリが選択されていません')
      return
    }

    setIsLoadingLatestFirmwares(true)

    try {
      const newFirmwares = await fetchLatestFirmware(
        selectedRepo,
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
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">ファームウェア選択</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGetLatest}
                    disabled={isLoadingLatestFirmwares}
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
