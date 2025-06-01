import { Button } from '@/components/ui/button'
import { DialogHeader, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'

// RepositoryDialog Component
export interface RepositoryDialogProps {
  open: boolean
  setOpen: (open: boolean) => void
  newRepoUrl: string
  setNewRepoUrl: (url: string) => void
  newRepoPAT: string
  setNewRepoPAT: (pat: string) => void
  savePAT: boolean
  setSavePAT: (save: boolean) => void
  addRepository: () => Promise<void>
}

export default function RepositoryDialog({
  open,
  setOpen,
  newRepoUrl,
  setNewRepoUrl,
  newRepoPAT,
  setNewRepoPAT,
  savePAT,
  setSavePAT,
  addRepository,
}: RepositoryDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('flasher.dialog.repository.title')}</DialogTitle>
          <DialogDescription>
            {t('flasher.dialog.repository.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="repo-url">
              {t('flasher.dialog.repository.url')}
            </Label>
            <Input
              id="repo-url"
              placeholder="https://github.com/owner/repo"
              value={newRepoUrl}
              onChange={(e) => setNewRepoUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="repo-pat">
              {t('flasher.dialog.repository.pat')}
            </Label>
            <Input
              id="repo-pat"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={newRepoPAT}
              onChange={(e) => setNewRepoPAT(e.target.value)}
            />
            <div className="flex items-center space-x-2 mt-2">
              <Checkbox
                id="save-pat"
                checked={savePAT}
                onCheckedChange={(checked) => setSavePAT(checked === true)}
              />
              <label
                htmlFor="save-pat"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('flasher.dialog.repository.savePat')}
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('flasher.dialog.repository.cancel')}
          </Button>
          <Button onClick={addRepository}>
            {t('flasher.dialog.repository.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
