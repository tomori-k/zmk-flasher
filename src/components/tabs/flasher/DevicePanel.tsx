import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Device } from '@/types/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Keyboard, Loader2, RefreshCw, AlertTriangle } from 'lucide-react'

// DevicePanel Component
export interface DevicePanelProps {
  devices: Device[]
  selectedDevice: Device | null
  setSelectedDevice: (device: Device | null) => void
  isLoadingDevices: boolean
  refreshDevices: () => Promise<void>
}

export default function DevicePanel({
  devices,
  selectedDevice,
  setSelectedDevice,
  isLoadingDevices,
  refreshDevices,
}: DevicePanelProps) {
  return (
    <div className="h-full flex flex-col border-r">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2">
          <Keyboard className="h-4 w-4" />① 接続キーボード
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshDevices}
          disabled={isLoadingDevices}
        >
          {isLoadingDevices ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {isLoadingDevices ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : devices.length > 0 ? (
          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className={`p-3 rounded-md cursor-pointer border ${
                  selectedDevice?.id === device.id
                    ? 'bg-primary/10 border-primary'
                    : 'hover:bg-muted border-transparent'
                }`}
                onClick={() => setSelectedDevice(device)}
              >
                <div className="font-medium">{device.name}</div>
                {device.side && (
                  <div className="text-sm text-muted-foreground">
                    {device.side === 'left' ? '左側' : '右側'}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {device.vid}:{device.pid}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>デバイスが見つかりません</AlertTitle>
            <AlertDescription>
              キーボードがブートローダーモードで接続されていることを確認してください。
            </AlertDescription>
          </Alert>
        )}
      </ScrollArea>
    </div>
  )
}
