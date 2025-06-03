import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import i18n from './i18n'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useRepositoriesStore } from './stores/repositories'
import { loadSettings, saveSettings } from './services/settings/current'
import './index.css'

async function init() {
  if (typeof window !== 'undefined') {
    const settings = await loadSettings()

    i18n.changeLanguage(settings.language)
    useRepositoriesStore.setState({
      repositories: settings.repositories,
      selectedRepositoryUrl: settings.selectedRepositoryUrl,
    })
  }

  // ウィンドウが閉じられる前に設定を保存する
  const appWindow = getCurrentWindow()
  appWindow.onCloseRequested(async () => {
    const repositoriesState = useRepositoriesStore.getState()
    const language = i18n.language

    await saveSettings({
      language,
      repositories: repositoriesState.repositories,
      selectedRepositoryUrl: repositoriesState.selectedRepositoryUrl,
    })
  })
}

init()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
