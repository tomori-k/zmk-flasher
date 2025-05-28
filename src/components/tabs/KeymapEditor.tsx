import { Button } from '../ui/button'
import { ExternalLink } from 'lucide-react'
// Tauriのshellモジュールをインポート

// キーマップエディタのデフォルトURL
const DEFAULT_KEYMAP_EDITOR_URL = 'https://nickcoutsos.github.io/keymap-editor/'

/**
 * メインのKeymap Editorコンポーネント
 */
export default function KeymapEditor() {
  // Tauriを使って外部ブラウザで開く処理
  const handleOpenExternal = async () => {
    // フォールバック: Tauriが動作していない環境（開発環境など）ではwindow.openを使用
    window.open(DEFAULT_KEYMAP_EDITOR_URL, '_blank')
  }

  return (
    <div className="flex justify-center">
      <a href={DEFAULT_KEYMAP_EDITOR_URL} target="_blank">
        <Button size="lg" onClick={handleOpenExternal} className="">
          <ExternalLink className="h-4 w-4" />
          ブラウザでKeymap Editorを開く
        </Button>
      </a>
    </div>
  )
}
