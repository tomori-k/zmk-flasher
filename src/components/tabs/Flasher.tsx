import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Device, Firmware, Repository } from '@/types/types'
import { useRepositoriesStore } from '@/stores/repositories'
import DevicePanel from './flasher/DevicePanel'
import FirmwarePanel from './flasher/FirmwarePanel'
import { RepositoryPanel } from './flasher/RepositoryPanel'
import { BottomBar } from './flasher/BottomBar'
import ProgressDialog from './flasher/ProgressBarDialog'
import RepositoryDialog from './flasher/RepositoryDialog'
import { FlashProgress } from './flasher/types'
import { extractRepoInfo } from '@/lib/repoUtils'
import { apiClient } from '@/services/apiClientFactory'
import { useLifetimeAbort } from '@/hooks/use-lifetime-abort'
import { invoke } from '@tauri-apps/api/core'

export default function Flasher() {
  // リポジトリストアからデータとアクションを取得
  const {
    repositories,
    selectedRepositoryUrl,
    setSelectedRepositoryUrl,
    addRepository: addRepoToStore,
    removeRepository: removeRepoFromStore,
    getSelectedRepository,
    // ワークフロー関連の状態とアクション
    workflows,
    isLoadingWorkflows,
    setWorkflows,
    setIsLoadingWorkflows,
    setSelectedWorkflowId,
  } = useRepositoriesStore()

  // State
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [isLoadingDevices, setIsLoadingDevices] = useState(false)

  const [firmwares, setFirmwares] = useState<Firmware[]>([])
  const [selectedFirmware, setSelectedFirmware] = useState<Firmware | null>(
    null
  )
  const [isLoadingFirmwares, setIsLoadingFirmwares] = useState(false)

  const [isCompatible, setIsCompatible] = useState<boolean | null>(null)
  const [repoDialogOpen, setRepoDialogOpen] = useState(false)
  const [progressDialogOpen, setProgressDialogOpen] = useState(false)
  const [flashProgress, setFlashProgress] = useState<FlashProgress>({
    percentage: 0,
    status: 'idle',
  })

  // Form state for repository dialog
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [newRepoPAT, setNewRepoPAT] = useState('')
  const [savePAT, setSavePAT] = useState(false)

  const refLifetimeAbort = useLifetimeAbort()

  // リポジトリのワークフローを取得する関数
  const fetchWorkflows = async (repoUrl: string | null) => {
    if (!repoUrl || refLifetimeAbort.current == null) return

    setIsLoadingWorkflows(true)

    try {
      // リポジトリURLからリポジトリオブジェクトを作成
      const repository: Repository = { url: repoUrl }

      // ワークフローを取得
      const workflowList = await apiClient.fetchWorkflows(
        repository,
        refLifetimeAbort.current.signal
      )

      // ストアに取得したワークフローを設定
      setWorkflows(workflowList)

      // 選択中のリポジトリにワークフローIDが設定されていなければ、
      // 最初のワークフローを選択する
      const selectedRepo = getSelectedRepository()
      if (selectedRepo && !selectedRepo.workflowId && workflowList.length > 0) {
        setSelectedWorkflowId(workflowList[0].id)
      }
    } catch (error) {
      toast.error('ワークフローの取得に失敗しました', {
        description:
          error instanceof Error ? error.message : '不明なエラーが発生しました',
        duration: 5000,
      })

      // エラー時はワークフローをクリア
      setWorkflows([])
    } finally {
      setIsLoadingWorkflows(false)
    }
  }

  const handleRefreshDevices = async () => {
    setIsLoadingDevices(true)
    try {
      // Tauriのバックエンドから接続されているZMKデバイスのリストを取得
      const zmkDevices = await invoke<Device[]>('detect_zmk_devices')
      setDevices(zmkDevices)

      // デバイスが見つからない場合は通知
      if (zmkDevices.length === 0) {
        toast.info('ZMKキーボードが見つかりませんでした', {
          description:
            'キーボードがブートローダーモードで接続されていることを確認してください',
        })
      } else {
        toast.success(`${zmkDevices.length}台のZMKキーボードを検出しました`)
      }
    } catch (error) {
      toast.error('デバイス検出エラー', {
        description:
          error instanceof Error ? error.message : '不明なエラーが発生しました',
      })
    } finally {
      setIsLoadingDevices(false)
    }
  }

  const loadFirmwares = async () => {
    if (!selectedDevice || !selectedRepositoryUrl) return

    setIsLoadingFirmwares(true)
    setSelectedFirmware(null)

    try {
      // Mock data - replace with actual firmware fetching logic
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setFirmwares([
        {
          id: '1',
          name: 'corne_left.uf2',
          path: '/firmware/corne_left.uf2',
          buildDate: '2025-05-28T14:30:00Z',
          branch: 'main',
          boardId: 'nice_nano',
          familyId: 'nRF52840',
          size: 245760,
        },
        {
          id: '2',
          name: 'corne_right.uf2',
          path: '/firmware/corne_right.uf2',
          buildDate: '2025-05-28T14:30:00Z',
          branch: 'main',
          boardId: 'nice_nano',
          familyId: 'nRF52840',
          size: 245760,
        },
      ])
    } catch (error) {
      console.error('Failed to load firmwares:', error)
    } finally {
      setIsLoadingFirmwares(false)
    }
  }

  // リポジトリの追加
  const addRepository = async () => {
    // Validate input
    if (!newRepoUrl) {
      toast.error('リポジトリURLを入力してください')
      return
    }

    try {
      // リポジトリをストアに追加
      addRepoToStore(newRepoUrl)
      setRepoDialogOpen(false)

      // リポジトリが追加されたらワークフローを取得
      await fetchWorkflows(newRepoUrl)

      // 成功メッセージを表示
      const repoInfo = extractRepoInfo(newRepoUrl)
      if (repoInfo) {
        toast.success(
          `リポジトリ ${repoInfo.owner}/${repoInfo.repo} を追加しました`
        )
      } else {
        toast.success('リポジトリを追加しました')
      }

      // フォームをリセット
      setNewRepoUrl('')
      setNewRepoPAT('')
      setSavePAT(false)
    } catch (error) {
      // エラーメッセージを表示
      toast.error(
        error instanceof Error ? error.message : '不明なエラーが発生しました'
      )
    }
  }

  // リポジトリの削除
  const removeRepository = (url: string) => {
    try {
      // リポジトリ情報を取得
      const repoInfo = extractRepoInfo(url)

      // リポジトリリストから削除
      removeRepoFromStore(url)

      // 成功メッセージを表示
      if (repoInfo) {
        toast.success(
          `リポジトリ ${repoInfo.owner}/${repoInfo.repo} を削除しました`
        )
      } else {
        toast.success('リポジトリを削除しました')
      }

      // 選択中のリポジトリが削除された場合は選択解除
      if (selectedRepositoryUrl === url) {
        setFirmwares([])
        setSelectedFirmware(null)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '不明なエラーが発生しました'
      )
    }
  }

  const checkCompatibility = () => {
    if (!selectedDevice || !selectedFirmware) {
      setIsCompatible(null)
      return
    }

    // Mock compatibility check - implement actual logic
    const isLeftSide = selectedDevice.side === 'left'
    const isLeftFirmware = selectedFirmware.name.includes('left')

    // Simple check - match left/right side with firmware
    if (selectedDevice.side) {
      setIsCompatible(
        (isLeftSide && isLeftFirmware) || (!isLeftSide && !isLeftFirmware)
      )
    } else {
      // For devices without side information
      setIsCompatible(true)
    }
  }

  const flashFirmware = async () => {
    if (!selectedDevice || !selectedFirmware || !isCompatible) return

    setProgressDialogOpen(true)
    setFlashProgress({
      percentage: 0,
      bytesWritten: 0,
      totalBytes: selectedFirmware.size,
      status: 'flashing',
      message: 'Preparing to flash...',
    })

    try {
      // Mock flashing process - replace with actual implementation
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        setFlashProgress({
          percentage: i,
          bytesWritten: Math.floor((i / 100) * selectedFirmware.size),
          totalBytes: selectedFirmware.size,
          status: 'flashing',
          message:
            i < 100 ? `Flashing firmware... ${i}%` : 'Verifying firmware...',
        })
      }

      // Simulate success
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setFlashProgress({
        percentage: 100,
        bytesWritten: selectedFirmware.size,
        totalBytes: selectedFirmware.size,
        status: 'success',
        message: 'Firmware successfully flashed!',
      })

      // 成功トーストを表示
      toast.success(
        `${selectedFirmware.name} を ${selectedDevice.name} に書き込みました`,
        {
          description: '書き込みが正常に完了しました',
          duration: 5000,
        }
      )
    } catch (error) {
      console.error('Flash failed:', error)
      setFlashProgress({
        percentage: 0,
        status: 'error',
        message: `Flash failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      })

      // エラートーストを表示
      toast.error('ファームウェアの書き込みに失敗しました', {
        description:
          error instanceof Error ? error.message : '不明なエラーが発生しました',
        duration: 8000,
      })
    }
  }

  const retryFlash = () => {
    setFlashProgress({
      percentage: 0,
      status: 'idle',
    })
    flashFirmware()
  }

  // 選択されたワークフローIDの更新を処理する関数
  const handleWorkflowSelect = (workflowId: number | null) => {
    // ワークフローIDをストアに設定
    setSelectedWorkflowId(workflowId)

    // ワークフロー選択時のトースト表示
    if (workflowId) {
      const selectedWorkflow = workflows.find((w) => w.id === workflowId)
      if (selectedWorkflow) {
        const repoInfo = extractRepoInfo(selectedRepositoryUrl || '')
        if (repoInfo) {
          toast.success(
            `ワークフロー「${selectedWorkflow.name}」を選択しました`,
            {
              duration: 3000,
            }
          )
        }
      }
    }
  }

  // リポジトリが選択されたときのコールバック
  const handleRepositorySelected = (repoUrl: string) => {
    // 選択されたリポジトリのワークフローを取得
    fetchWorkflows(repoUrl)
  }

  // 初期化処理
  useEffect(() => {
    // デバイス一覧の取得
    handleRefreshDevices()
  }, [])

  // リポジトリまたはデバイスが変更されたらファームウェア一覧を更新
  useEffect(() => {
    if (selectedDevice && selectedRepositoryUrl) {
      loadFirmwares()
    } else {
      setFirmwares([])
      setSelectedFirmware(null)
    }
  }, [selectedDevice, selectedRepositoryUrl])

  // 互換性チェック
  useEffect(() => {
    checkCompatibility()
  }, [selectedDevice, selectedFirmware])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - Device List */}
          <ResizablePanel defaultSize={25} minSize={20}>
            <DevicePanel
              devices={devices}
              selectedDevice={selectedDevice}
              setSelectedDevice={setSelectedDevice}
              isLoadingDevices={isLoadingDevices}
              onRefreshDevice={handleRefreshDevices}
            />
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel - Stacked Panels */}
          <ResizablePanel defaultSize={75}>
            <ResizablePanelGroup direction="vertical">
              {/* Top Panel - Firmware Source */}
              <ResizablePanel defaultSize={40} minSize={25}>
                <RepositoryPanel
                  repositories={repositories}
                  selectedRepo={selectedRepositoryUrl}
                  setSelectedRepo={setSelectedRepositoryUrl}
                  setRepoDialogOpen={setRepoDialogOpen}
                  removeRepository={removeRepository}
                  onRepositorySelected={handleRepositorySelected}
                />
              </ResizablePanel>

              <ResizableHandle />

              {/* Bottom Panel - Firmware Selection */}
              <ResizablePanel defaultSize={60}>
                <FirmwarePanel
                  selectedDevice={selectedDevice}
                  selectedRepo={selectedRepositoryUrl}
                  firmwares={firmwares}
                  selectedFirmware={selectedFirmware}
                  setSelectedFirmware={setSelectedFirmware}
                  isLoadingFirmwares={isLoadingFirmwares}
                  isCompatible={isCompatible}
                  onRefreshFirmwares={(newFirmwares) => {
                    setFirmwares((prevFirmwares) => {
                      // 既存のファームウェアリストに新しいファームウェアを追加
                      // 重複を避けるため、IDでフィルタリング
                      const existingIds = new Set(
                        prevFirmwares.map((f) => f.id)
                      )
                      const uniqueNewFirmwares = newFirmwares.filter(
                        (f) => !existingIds.has(f.id)
                      )
                      return [...prevFirmwares, ...uniqueNewFirmwares]
                    })

                    // 新しいファームウェアが追加されたことを通知
                    if (newFirmwares.length > 0) {
                      toast.success(
                        `${newFirmwares.length}個の新しいファームウェアを取得しました`
                      )
                    } else {
                      toast.info('新しいファームウェアはありませんでした')
                    }
                  }}
                  setSelectedWorkflowId={handleWorkflowSelect}
                  workflows={workflows}
                  isLoadingWorkflows={isLoadingWorkflows}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Bottom Bar - Flash Operation */}
      <BottomBar
        selectedDevice={selectedDevice}
        selectedFirmware={selectedFirmware}
        isCompatible={isCompatible}
        flashProgress={flashProgress}
        flashFirmware={flashFirmware}
      />

      {/* Dialogs */}
      <RepositoryDialog
        open={repoDialogOpen}
        setOpen={setRepoDialogOpen}
        newRepoUrl={newRepoUrl}
        setNewRepoUrl={setNewRepoUrl}
        newRepoPAT={newRepoPAT}
        setNewRepoPAT={setNewRepoPAT}
        savePAT={savePAT}
        setSavePAT={setSavePAT}
        addRepository={addRepository}
      />

      <ProgressDialog
        open={progressDialogOpen}
        setOpen={setProgressDialogOpen}
        progress={flashProgress}
        retryFlash={retryFlash}
      />
    </div>
  )
}
