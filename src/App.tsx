import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Flasher from '@/components/tabs/Flasher'
import KeymapEditor from '@/components/tabs/KeymapEditor'

function App() {
  const [greetMsg, setGreetMsg] = useState('')
  const [name, setName] = useState('')

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke('greet', { name }))
  }

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
    </main>
  )
}

export default App
