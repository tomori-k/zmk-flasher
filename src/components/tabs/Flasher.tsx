import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Device, Repository, Firmware } from '@/types/types'
import { useRepositoriesStore } from '@/stores/repositories'
import DevicePanel from './flasher/DevicePanel'
import FirmwarePanel from './flasher/FirmwarePanel'
import { RepositoryPanel } from './flasher/RepositoryPanel'
import { BottomBar } from './flasher/BottomBar'
import ProgressDialog from './flasher/ProgressBarDialog'
import RepositoryDialog from './flasher/RepositoryDialog'
import { FlashProgress } from './flasher/types'

export default function Flasher() {
  // リポジトリストアからデータとアクションを取得
  const {
    repositories,
    selectedRepository,
    setSelectedRepository,
    addRepository: addRepoToStore,
    removeRepository: removeRepoFromStore,
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

  // Mock functions - replace with actual implementations
  const refreshDevices = async () => {
    setIsLoadingDevices(true)
    try {
      // Mock data - replace with actual device detection logic
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setDevices([
        {
          id: '1',
          name: 'Corne Keyboard',
          side: 'left',
          pid: '0x1234',
          vid: '0xFEED',
        },
        {
          id: '2',
          name: 'Corne Keyboard',
          side: 'right',
          pid: '0x1235',
          vid: '0xFEED',
        },
        { id: '3', name: 'Kyria Keyboard', pid: '0x4567', vid: '0xFEED' },
      ])
    } catch (error) {
      console.error('Failed to refresh devices:', error)
    } finally {
      setIsLoadingDevices(false)
    }
  }

  const loadFirmwares = async () => {
    if (!selectedDevice || !selectedRepository) return

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

    // GitHub URLのバリデーション
    const githubRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)/
    const match = newRepoUrl.match(githubRegex)

    if (!match) {
      toast.error(
        '有効なGitHub URLを入力してください (例: https://github.com/owner/repo)'
      )
      return
    }

    const owner = match[1]
    const repo = match[2]

    // 既存のリポジトリと重複しないか確認
    const isDuplicate = repositories.some(
      (r) => r.owner === owner && r.repo === repo
    )

    if (isDuplicate) {
      toast.error('このリポジトリは既に追加されています')
      return
    }

    // 新しいリポジトリを作成
    const newRepo: Repository = {
      id: Date.now().toString(),
      url: newRepoUrl,
      owner,
      repo,
    }

    // リポジトリリストに追加
    addRepoToStore(newRepo)
    setSelectedRepository(newRepo)
    setRepoDialogOpen(false)

    // 成功メッセージを表示
    toast.success(`リポジトリ ${owner}/${repo} を追加しました`)

    // フォームをリセット
    setNewRepoUrl('')
    setNewRepoPAT('')
    setSavePAT(false)
  }

  // リポジトリの削除
  const removeRepository = (id: string) => {
    // 削除するリポジトリを確認
    const repoToRemove = repositories.find((r) => r.id === id)
    if (!repoToRemove) return

    // リポジトリリストから削除
    removeRepoFromStore(repoToRemove.id)

    // 成功メッセージを表示
    toast.success(
      `リポジトリ ${repoToRemove.owner}/${repoToRemove.repo} を削除しました`
    )

    // 選択中のリポジトリが削除される場合は選択解除
    if (selectedRepository?.id === id) {
      setSelectedRepository(null)
      setFirmwares([])
      setSelectedFirmware(null)
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

  // 初期化処理
  useEffect(() => {
    // デバイス一覧の取得
    refreshDevices()
  }, [])

  // リポジトリまたはデバイスが変更されたらファームウェア一覧を更新
  useEffect(() => {
    if (selectedDevice && selectedRepository) {
      loadFirmwares()
    } else {
      setFirmwares([])
      setSelectedFirmware(null)
    }
  }, [selectedDevice, selectedRepository])

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
              refreshDevices={refreshDevices}
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
                  selectedRepo={selectedRepository}
                  setSelectedRepo={setSelectedRepository}
                  setRepoDialogOpen={setRepoDialogOpen}
                  removeRepository={removeRepository}
                />
              </ResizablePanel>

              <ResizableHandle />

              {/* Bottom Panel - Firmware Selection */}
              <ResizablePanel defaultSize={60}>
                <FirmwarePanel
                  selectedDevice={selectedDevice}
                  selectedRepo={selectedRepository}
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
