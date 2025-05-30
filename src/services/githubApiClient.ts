import { Repository, Workflow } from '@/types/types'
import { extractRepoInfo } from '@/lib/repoUtils'

/**
 * GitHub API クライアントのインターフェース
 * このインターフェースを実装することで、実際のAPIクライアントとモックを切り替えられます
 */
export interface GitHubApiClient {
  /**
   * リポジトリのワークフロー一覧を取得
   */
  fetchWorkflows(
    repository: Repository,
    signal: AbortSignal,
    page?: number,
    perPage?: number
  ): Promise<Workflow[]>

  /**
   * 特定のワークフローの実行履歴を取得
   */
  fetchWorkflowRuns(
    repository: Repository,
    workflowId: number,
    signal: AbortSignal,
    page?: number,
    perPage?: number
  ): Promise<any[]>

  /**
   * ワークフロー実行のアーティファクトを取得
   */
  fetchWorkflowRunsArtifacts(
    repository: Repository,
    workflowRunId: number,
    signal: AbortSignal
  ): Promise<any[]>
}

// デフォルトのAPI実装をエクスポート
export const githubApiClient: GitHubApiClient = {
  async fetchWorkflows(
    repository: Repository,
    signal: AbortSignal,
    page: number = 1,
    perPage: number = 10
  ): Promise<Workflow[]> {
    const repoInfo = extractRepoInfo(repository.url)
    if (!repoInfo) {
      throw new Error('無効なリポジトリURLです')
    }

    const { owner, repo } = repoInfo

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows?per_page=${perPage}&page=${page}`,
      { signal }
    )

    if (!response.ok) {
      throw new Error(
        `ワークフローの取得に失敗しました (${
          response.status
        }): ${await response.text()}`
      )
    }

    const data = await response.json()
    return data.workflows || []
  },

  async fetchWorkflowRuns(
    repository: Repository,
    workflowId: number,
    signal: AbortSignal,
    page: number = 1,
    perPage: number = 10
  ): Promise<any[]> {
    const repoInfo = extractRepoInfo(repository.url)
    if (!repoInfo) {
      throw new Error('無効なリポジトリURLです')
    }

    const { owner, repo } = repoInfo

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=${perPage}&page=${page}`,
      { signal }
    )

    if (!response.ok) {
      throw new Error(
        `ワークフローランの取得に失敗しました (${
          response.status
        }): ${await response.text()}`
      )
    }

    const data = await response.json()
    return data.workflow_runs || []
  },

  async fetchWorkflowRunsArtifacts(
    repository: Repository,
    workflowRunId: number,
    signal: AbortSignal
  ): Promise<any[]> {
    const repoInfo = extractRepoInfo(repository.url)
    if (!repoInfo) {
      throw new Error('無効なリポジトリURLです')
    }

    const { owner, repo } = repoInfo

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${workflowRunId}/artifacts`,
      { signal }
    )

    if (!response.ok) {
      throw new Error(
        `Artifactsの取得に失敗しました (${
          response.status
        }): ${await response.text()}`
      )
    }

    const data = await response.json()
    return data.artifacts || []
  },
}
