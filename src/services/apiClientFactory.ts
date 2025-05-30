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
  if (typeof window !== 'undefined' && (window as any).__USE_MOCK_API__) {
    return true
  }

  console.log('USE_MOCK_API is not set, using real API client')

  return true
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
