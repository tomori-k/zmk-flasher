import { create } from 'zustand'
import { Repository } from '@/types/types'
import { getRepoDisplayName, isValidGithubUrl } from '@/lib/repoUtils'

// リポジトリストアの状態定義
interface RepositoriesState {
  // データ
  repositories: Repository[]
  selectedRepositoryUrl: string | null

  // アクション
  setRepositories: (repositories: Repository[]) => void
  setSelectedRepositoryUrl: (url: string | null) => void
  addRepository: (url: string) => void
  removeRepository: (url: string) => void
  updateRepository: (repository: Repository) => void

  // 選択されているリポジトリを取得するユーティリティ
  getSelectedRepository: () => Repository | null

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

  // アクション
  setRepositories: (repositories) => set({ repositories }),

  setSelectedRepositoryUrl: (url) => set({ selectedRepositoryUrl: url }),

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

  // 初期化関数
  initialize: () =>
    set({
      repositories: SAMPLE_REPOSITORIES,
      selectedRepositoryUrl:
        SAMPLE_REPOSITORIES.length > 0 ? SAMPLE_REPOSITORIES[0].url : null,
    }),
}))
