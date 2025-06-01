import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogFooter } from '@/components/ui/dialog'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { FlashProgress } from './types'
import { useTranslation } from 'react-i18next'

// ProgressDialog Component
export interface ProgressDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
  progress: FlashProgress
  retryFlash: () => void
}

export default function ProgressDialog({
  open,
  setOpen,
  progress,
  retryFlash,
}: ProgressDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {progress.status === 'flashing'
              ? t('flasher.dialog.progress.flashing')
              : progress.status === 'success'
              ? t('flasher.dialog.progress.success')
              : progress.status === 'error'
              ? t('flasher.dialog.progress.error')
              : t('flasher.dialog.progress.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <Progress value={progress.percentage} className="mb-4" />

          <p className="text-center mb-2">
            {progress.bytesWritten !== undefined &&
            progress.totalBytes !== undefined
              ? `${Math.round(progress.bytesWritten / 1024)} KB / ${Math.round(
                  progress.totalBytes / 1024
                )} KB`
              : `${progress.percentage}%`}
          </p>

          {progress.message && (
            <Alert>
              <AlertDescription>{progress.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {progress.status === 'success' ? (
            <Button onClick={() => setOpen(false)}>
              {t('flasher.dialog.progress.close')}
            </Button>
          ) : progress.status === 'error' ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('flasher.dialog.progress.close')}
              </Button>
              <Button onClick={retryFlash}>
                {t('flasher.dialog.progress.retry')}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
