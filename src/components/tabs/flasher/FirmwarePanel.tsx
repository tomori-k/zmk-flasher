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
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

// FirmwarePanel Component
export interface FirmwarePanelProps {
  selectedDevice: Device | null
  selectedRepo: Repository | null
  firmwares: Firmware[]
  selectedFirmware: Firmware | null
  setSelectedFirmware: (firmware: Firmware | null) => void
  isLoadingFirmwares: boolean
  isCompatible: boolean | null
}

export default function FirmwarePanel({
  selectedDevice,
  selectedRepo,
  firmwares,
  selectedFirmware,
  setSelectedFirmware,
  isLoadingFirmwares,
  isCompatible,
}: FirmwarePanelProps) {
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
            ) : firmwares.length > 0 ? (
              <div className="space-y-4">
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
                        {new Date(firmware.buildDate).toLocaleDateString()} -{' '}
                        {firmware.branch})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedFirmware && (
                  <div className="mt-6 space-y-4">
                    <h4 className="font-medium">④ 詳細／互換チェック</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">BoardID</p>
                        <p>{selectedFirmware.boardId || 'なし'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          FamilyID
                        </p>
                        <p>{selectedFirmware.familyId || 'なし'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">サイズ</p>
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
                      <Alert variant={isCompatible ? 'default' : 'destructive'}>
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
                  </div>
                )}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  該当するファームウェアが見つかりません。別のデバイスまたはリポジトリを選択してください。
                </AlertDescription>
              </Alert>
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
