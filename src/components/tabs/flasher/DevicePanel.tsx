import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Device } from '@/types/types'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Keyboard,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Usb,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'

// DevicePanel Component
export interface DevicePanelProps {
  devices: Device[]
  selectedDevice: Device | null
  setSelectedDevice: (device: Device | null) => void
  isLoadingDevices: boolean
  onRefreshDevice: () => void
}

const usbDevice = (function () {
  const callbacks: (() => void)[] = []

  type MonitoringState =
    | 'started'
    | 'stopped'
    | 'start-requested'
    | 'stop-requested'

  let state: MonitoringState = 'stopped'

  async function startUsbMonitoring() {
    if (state === 'started') return
    state = 'start-requested'
    await invoke('start_usb_monitoring')
    state = 'started'
  }

  async function stopUsbMonitoring() {
    if (state === 'stopped') return
    state = 'stop-requested'
    await invoke('stop_usb_monitoring')
    state = 'stopped'
  }

  if (typeof window !== 'undefined') {
    async function listenForUsbChanges() {
      const unlisten = await listen<Device[]>('usb-device-changed', (event) => {
        console.log('USBデバイスの変更を検知しました:', event.payload)
        callbacks.forEach((callback) => callback())
      })
      return unlisten
    }

    const unlistenPromise = listenForUsbChanges()

    window.addEventListener('beforeunload', () => {
      stopUsbMonitoring()
      unlistenPromise.then((unlisten) => {
        unlisten()
      })
    })
  }

  return {
    /**
     * USBデバイスの変更イベントをリッスンする
     * @returns {Function} イベントリスナーを解除する関数
     * */
    listen(callback: () => void): () => void {
      callbacks.push(callback)
      startUsbMonitoring()
      return () => {
        const index = callbacks.indexOf(callback)
        if (index !== -1) {
          callbacks.splice(index, 1)
          if (callbacks.length === 0) {
            stopUsbMonitoring()
          }
        }
      }
    },
  }
})()

export default function DevicePanel({
  devices,
  selectedDevice,
  setSelectedDevice,
  isLoadingDevices,
  onRefreshDevice,
}: DevicePanelProps) {
  const latestOnRefreshDevice = useRef(onRefreshDevice)
  latestOnRefreshDevice.current = onRefreshDevice

  // USBデバイス変更イベントを検知するリスナーをセットアップ
  useEffect(() => {
    const unlisten = usbDevice.listen(() => {
      latestOnRefreshDevice.current()
    })

    return () => {
      unlisten()
    }
  }, [])
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col border-r">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2">
          <Keyboard className="h-4 w-4" />① {t('flasher.devicePanel.title')}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefreshDevice}
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
            <AlertTitle>{t('flasher.devicePanel.noDevices')}</AlertTitle>
            <AlertDescription>
              {t('flasher.toast.checkBootloader')}
              <div className="mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefreshDevice}
                  className="w-full"
                >
                  {t('flasher.devicePanel.refresh')}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </ScrollArea>
    </div>
  )
}
