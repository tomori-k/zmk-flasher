import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Settings } from 'lucide-react'

export function SettingsDialog() {
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  // 言語切り替え関数
  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('settings.title', '設定')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="language" className="text-right">
              {t('settings.language', '言語')}
            </Label>
            <Select
              value={i18n.language}
              onValueChange={(value) => changeLanguage(value)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue
                  placeholder={t('settings.selectLanguage', '言語を選択')}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => setIsOpen(false)}>
            {t('settings.close', '閉じる')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
