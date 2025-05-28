import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogFooter } from '@/components/ui/dialog'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { FlashProgress } from './types'

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
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {progress.status === 'flashing'
              ? 'ファームウェア書き込み中...'
              : progress.status === 'success'
              ? '書き込み成功'
              : progress.status === 'error'
              ? '書き込み失敗'
              : 'ファームウェア書き込み'}
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
            <Button onClick={() => setOpen(false)}>完了</Button>
          ) : progress.status === 'error' ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                閉じる
              </Button>
              <Button onClick={retryFlash}>リトライ</Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
