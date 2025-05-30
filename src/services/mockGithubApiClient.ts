import { Repository, Workflow } from '@/types/types'
import { GitHubApiClient } from './githubApiClient'

/**
 * GitHub API クライアントのモック実装
 * テスト時に実際のAPIを呼び出さずにモックデータを返すために使用します
 */
export const mockGithubApiClient: GitHubApiClient = {
  async fetchWorkflows(
    repository: Repository,
    signal: AbortSignal,
    page: number = 1,
    perPage: number = 10
  ): Promise<Workflow[]> {
    // テスト用のモックデータ
    return [
      {
        id: 1,
        name: 'Build ZMK firmware',
        path: '.github/workflows/build.yml',
        state: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        url: 'https://api.github.com/repos/owner/repo/actions/workflows/1',
        html_url: 'https://github.com/owner/repo/actions/workflows/build.yml',
        badge_url:
          'https://github.com/owner/repo/workflows/Build%20ZMK%20firmware/badge.svg',
      },
      {
        id: 2,
        name: 'Build Custom firmware',
        path: '.github/workflows/custom.yml',
        state: 'active',
        created_at: '2025-01-02T00:00:00Z',
        updated_at: '2025-01-02T00:00:00Z',
        url: 'https://api.github.com/repos/owner/repo/actions/workflows/2',
        html_url: 'https://github.com/owner/repo/actions/workflows/custom.yml',
        badge_url:
          'https://github.com/owner/repo/workflows/Build%20Custom%20firmware/badge.svg',
      },
    ]
  },

  async fetchWorkflowRuns(
    repository: Repository,
    workflowId: number,
    signal: AbortSignal,
    page: number = 1,
    perPage: number = 10
  ): Promise<any[]> {
    // テスト用のモックデータ
    return [
      {
        id: 101,
        name: 'Build ZMK firmware',
        head_branch: 'main',
        head_commit: {
          message: 'テスト用のコミットメッセージ',
        },
        status: 'completed',
        conclusion: 'success',
        workflow_id: workflowId,
        created_at: '2025-05-29T00:00:00Z',
        updated_at: '2025-05-29T00:00:00Z',
      },
    ]
  },

  async fetchWorkflowRunsArtifacts(
    repository: Repository,
    workflowRunId: number,
    signal: AbortSignal
  ): Promise<any[]> {
    // テスト用のモックデータ
    return [
      {
        id: 201,
        name: 'corne_left.uf2',
        size_in_bytes: 245760,
        created_at: '2025-05-29T00:00:00Z',
        updated_at: '2025-05-29T00:00:00Z',
        archive_download_url:
          'https://api.github.com/repos/owner/repo/actions/artifacts/201/zip',
      },
      {
        id: 202,
        name: 'corne_right.uf2',
        size_in_bytes: 245760,
        created_at: '2025-05-29T00:00:00Z',
        updated_at: '2025-05-29T00:00:00Z',
        archive_download_url:
          'https://api.github.com/repos/owner/repo/actions/artifacts/202/zip',
      },
    ]
  },
}
