import { useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { useRepositoriesStore } from '@/stores/repositories'
import Flasher from '@/components/tabs/Flasher'
import KeymapEditor from '@/components/tabs/KeymapEditor'
import { useTranslation } from 'react-i18next'
import { SettingsDialog } from '@/components/settings/SettingsDialog'

function App() {
  const { t } = useTranslation()

  // リポジトリストアの初期化
  const initializeRepositories = useRepositoriesStore(
    (state) => state.initialize
  )

  useEffect(() => {
    // アプリ起動時にリポジトリストアを初期化
    initializeRepositories()
  }, [])

  return (
    <main>
      <Tabs defaultValue="flasher" className="">
        <TabsList className="w-full">
          <TabsTrigger className="w-32 flex-none" value="flasher">
            {t('tabs.flasher')}
          </TabsTrigger>
          <TabsTrigger className="w-32 flex-none" value="keymap-editor">
            {t('tabs.keymapEditor')}
          </TabsTrigger>
          <div className="flex-1 flex justify-end">
            <SettingsDialog />
          </div>
        </TabsList>
        <TabsContent value="flasher">
          <Flasher />
        </TabsContent>
        <TabsContent value="keymap-editor">
          <KeymapEditor />
        </TabsContent>
      </Tabs>
      <Toaster />
    </main>
  )
}

export default App
