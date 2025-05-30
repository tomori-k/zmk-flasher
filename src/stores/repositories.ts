import { create } from 'zustand'
import { Repository, Workflow } from '@/types/types'
import { isValidGithubUrl } from '@/lib/repoUtils'

// リポジトリストアの状態定義
interface RepositoriesState {
  // データ
  repositories: Repository[]
  selectedRepositoryUrl: string | null
  workflows: Workflow[]
  isLoadingWorkflows: boolean

  // アクション
  setRepositories: (repositories: Repository[]) => void
  setSelectedRepositoryUrl: (url: string | null) => void
  addRepository: (url: string) => void
  removeRepository: (url: string) => void
  updateRepository: (repository: Repository) => void

  // ワークフロー関連のアクション - フェッチロジックは含まない
  setWorkflows: (workflows: Workflow[]) => void
  setIsLoadingWorkflows: (isLoading: boolean) => void
  setSelectedWorkflowId: (workflowId: number | null) => void

  // ユーティリティ関数
  getSelectedRepository: () => Repository | null
  getSelectedWorkflow: () => Workflow | null

  // 初期化
  initialize: () => void
}

// サンプルリポジトリデータ
const SAMPLE_REPOSITORIES: Repository[] = [
  {
    url: 'https://github.com/zmkfirmware/zmk',
  },
]

// リポジトリストアの作成
export const useRepositoriesStore = create<RepositoriesState>((set, get) => ({
  // 初期状態
  repositories: [],
  selectedRepositoryUrl: null,
  workflows: [],
  isLoadingWorkflows: false,

  // アクション
  setRepositories: (repositories) => set({ repositories }),

  setSelectedRepositoryUrl: (url) => {
    set({ selectedRepositoryUrl: url })

    // リポジトリが選択されていない場合はワークフローをクリア
    if (!url) {
      set({ workflows: [] })
    }
  },

  // ワークフロー関連のアクション
  setWorkflows: (workflows) => {
    set({ workflows })
  },

  setIsLoadingWorkflows: (isLoading) => set({ isLoadingWorkflows: isLoading }),

  setSelectedWorkflowId: (workflowId) => {
    const selectedRepo = get().getSelectedRepository()
    if (selectedRepo) {
      const updatedRepo = {
        ...selectedRepo,
        workflowId,
      }
      get().updateRepository(updatedRepo)
    }
  },

  addRepository: (url) => {
    if (!isValidGithubUrl(url)) {
      throw new Error('無効なGitHub URLです')
    }

    set((state) => {
      // 既に存在するかチェック
      if (state.repositories.some((repo) => repo.url === url)) {
        throw new Error('このリポジトリは既に追加されています')
      }

      const newRepo: Repository = { url }
      return {
        repositories: [...state.repositories, newRepo],
        selectedRepositoryUrl: url,
      }
    })
  },

  removeRepository: (url) =>
    set((state) => {
      const newRepositories = state.repositories.filter((r) => r.url !== url)
      const newSelectedRepositoryUrl =
        state.selectedRepositoryUrl === url ? null : state.selectedRepositoryUrl

      return {
        repositories: newRepositories,
        selectedRepositoryUrl: newSelectedRepositoryUrl,
      }
    }),

  updateRepository: (updatedRepository) =>
    set((state) => {
      const newRepositories = state.repositories.map((repository) =>
        repository.url === updatedRepository.url
          ? updatedRepository
          : repository
      )

      return {
        repositories: newRepositories,
      }
    }),

  // 選択されているリポジトリを取得するユーティリティ
  getSelectedRepository: () => {
    const { repositories, selectedRepositoryUrl } = get()
    if (!selectedRepositoryUrl) return null
    return (
      repositories.find((repo) => repo.url === selectedRepositoryUrl) || null
    )
  },

  // 選択されているワークフローを取得するユーティリティ
  getSelectedWorkflow: () => {
    const { workflows } = get()
    const selectedRepo = get().getSelectedRepository()

    if (!selectedRepo || !workflows.length) return null

    // リポジトリに保存されたワークフローIDがあればそれを選択
    if (selectedRepo.workflowId) {
      const savedWorkflow = workflows.find(
        (w) => w.id === selectedRepo.workflowId
      )
      if (savedWorkflow) {
        return savedWorkflow
      }
    }

    // 保存されたワークフローIDがないか、見つからない場合は最初のものを返す
    return null
  },

  // 初期化関数
  initialize: () => {
    set({
      repositories: SAMPLE_REPOSITORIES,
      selectedRepositoryUrl:
        SAMPLE_REPOSITORIES.length > 0 ? SAMPLE_REPOSITORIES[0].url : null,
    })
  },
}))
