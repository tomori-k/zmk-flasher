import { Button } from '@/components/ui/button'
import { Device, Firmware } from '@/types/types'
import { Progress } from '@radix-ui/react-progress'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { FlashProgress } from './types'

// BottomBar Component
export interface BottomBarProps {
  selectedDevice: Device | null
  selectedFirmware: Firmware | null
  isCompatible: boolean | null
  flashProgress: FlashProgress
  flashFirmware: () => Promise<void>
}

export function BottomBar({
  selectedDevice,
  selectedFirmware,
  isCompatible,
  flashProgress,
  flashFirmware,
}: BottomBarProps) {
  return (
    <div className="border-t bg-muted/40 p-2 flex items-center justify-between">
      <div className="flex items-center gap-2 px-2">
        <h3 className="text-sm font-medium">⑤ 書き込み操作</h3>
        {flashProgress.status === 'success' && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> 書き込み成功
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {flashProgress.status === 'flashing' && (
          <div className="flex items-center gap-2 w-48">
            <Progress value={flashProgress.percentage} className="h-2" />
            <span className="text-xs text-muted-foreground w-12">
              {flashProgress.percentage}%
            </span>
          </div>
        )}

        <Button
          className="gap-2"
          disabled={
            !selectedDevice ||
            !selectedFirmware ||
            !isCompatible ||
            flashProgress.status === 'flashing'
          }
          onClick={flashFirmware}
        >
          {flashProgress.status === 'flashing' && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Flash!
        </Button>
      </div>
    </div>
  )
}
