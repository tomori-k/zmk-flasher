import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/sonner'
import { useRepositoriesStore } from '@/stores/repositories'
import Flasher from '@/components/tabs/Flasher'
import KeymapEditor from '@/components/tabs/KeymapEditor'

function App() {
  const [greetMsg, setGreetMsg] = useState('')
  const [name, setName] = useState('')

  async function greet() {
    setGreetMsg(await invoke('greet', { name }))
  }

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
        <TabsList>
          <TabsTrigger value="flasher">Flash</TabsTrigger>
          <TabsTrigger value="keymap-editor">Edit Keymaps</TabsTrigger>
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
