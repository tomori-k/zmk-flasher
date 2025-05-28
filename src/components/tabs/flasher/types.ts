// Types

export interface FlashProgress {
  percentage: number
  bytesWritten?: number
  totalBytes?: number
  status: 'idle' | 'flashing' | 'success' | 'error'
  message?: string
}
