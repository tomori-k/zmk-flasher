import { GitHubApiClient, githubApiClient } from './githubApiClient'
import { mockGithubApiClient } from './mockGithubApiClient'

/**
 * テストモードかどうかを判定する
 * ビルド時または実行時の環境変数でテストモードを制御できます
 */
export const isTestMode = (): boolean => {
  // ビルド時の環境変数 (Viteでは import.meta.env.VITE_* の形式)
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return true
  }

  // あるいは実行時に window オブジェクトにフラグを設定することもできます
  if (
    typeof window !== 'undefined' &&
    (window as { __USE_MOCK_API__?: boolean }).__USE_MOCK_API__
  ) {
    return true
  }

  return false
}

/**
 * API クライアントのファクトリ関数
 * 環境に応じて実際のAPIクライアントかモックを返します
 */
export const getApiClient = (): GitHubApiClient => {
  return isTestMode() ? mockGithubApiClient : githubApiClient
}

// 現在の環境に適したAPIクライアントをエクスポート
export const apiClient = getApiClient()
