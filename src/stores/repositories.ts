import { create } from 'zustand'
import { Repository } from '@/types/types'

// リポジトリストアの状態定義
interface RepositoriesState {
  // データ
  repositories: Repository[]
  selectedRepository: Repository | null

  // アクション
  setRepositories: (repositories: Repository[]) => void
  setSelectedRepository: (repository: Repository | null) => void
  addRepository: (repository: Repository) => void
  removeRepository: (id: string) => void

  // 初期化
  initialize: () => void
}

// サンプルリポジトリデータ
const SAMPLE_REPOSITORIES: Repository[] = [
  {
    id: '1',
    url: 'https://github.com/zmkfirmware/zmk',
    owner: 'zmkfirmware',
    repo: 'zmk',
  },
]

// リポジトリストアの作成
export const useRepositoriesStore = create<RepositoriesState>((set) => ({
  // 初期状態
  repositories: [],
  selectedRepository: null,

  // アクション
  setRepositories: (repositories) => set({ repositories }),

  setSelectedRepository: (repository) =>
    set({ selectedRepository: repository }),

  addRepository: (repository) =>
    set((state) => ({
      repositories: [...state.repositories, repository],
      selectedRepository: repository,
    })),

  removeRepository: (id) =>
    set((state) => {
      const newRepositories = state.repositories.filter((r) => r.id !== id)
      const newSelectedRepository =
        state.selectedRepository?.id === id
          ? newRepositories.length > 0
            ? newRepositories[0]
            : null
          : state.selectedRepository

      return {
        repositories: newRepositories,
        selectedRepository: newSelectedRepository,
      }
    }),

  // 初期化関数
  initialize: () =>
    set({
      repositories: SAMPLE_REPOSITORIES,
      selectedRepository:
        SAMPLE_REPOSITORIES.length > 0 ? SAMPLE_REPOSITORIES[0] : null,
    }),
}))
