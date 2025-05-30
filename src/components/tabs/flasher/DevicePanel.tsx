import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Device } from '@/types/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Keyboard, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Usb } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

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
                <div className="flex items-center justify-between">
                  <div className="font-medium flex items-center gap-2">
                    {device.name}
                    {selectedDevice?.id === device.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    ZMK
                  </Badge>
                </div>
                
                {device.side && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {device.side === 'left' ? '左側' : '右側'}
                    </Badge>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Usb className="h-3 w-3" />
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
              ZMKキーボードがブートローダーモードで接続されていることを確認してください。
              <div className="mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={refreshDevices}
                  className="w-full"
                >
                  デバイスを再検索
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </ScrollArea>
    </div>
  )
}
