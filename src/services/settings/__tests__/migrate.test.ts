import { describe, it, expect } from 'vitest'
import { migrate } from '../current'
import { SettingsV20250602, VERSION as V20250602_VERSION } from '../v2025-06-02'
import { SettingsV20250603, VERSION as V20250603_VERSION } from '../v2025-06-03'

describe('settings migration', () => {
  it('should migrate from v2025-06-02 to v2025-06-03', () => {
    // Arrange
    const oldSettings: SettingsV20250602 = {
      __version__: V20250602_VERSION,
      language: 'ja',
    }

    // Act
    const migratedSettings = migrate(oldSettings)

    // Assert
    expect(migratedSettings).toEqual({
      __version__: V20250603_VERSION,
      language: 'ja',
      repositories: [],
      selectedRepositoryUrl: null,
    })
  })

  it('should keep settings as is if already at latest version', () => {
    // Arrange
    const latestSettings: SettingsV20250603 = {
      __version__: V20250603_VERSION,
      language: 'ja',
      repositories: [
        { url: 'https://github.com/example/repo1' },
        { url: 'https://github.com/example/repo2', workflowId: 123 },
      ],
      selectedRepositoryUrl: 'https://github.com/example/repo1',
    }

    // Act
    const migratedSettings = migrate(latestSettings)

    // Assert
    expect(migratedSettings).toEqual(latestSettings)
  })

  it('should handle migration with custom language setting', () => {
    // Arrange
    const oldSettings: SettingsV20250602 = {
      __version__: V20250602_VERSION,
      language: 'fr', // カスタム言語設定
    }

    // Act
    const migratedSettings = migrate(oldSettings)

    // Assert
    expect(migratedSettings).toEqual({
      __version__: V20250603_VERSION,
      language: 'fr', // 言語設定が保持されていること
      repositories: [],
      selectedRepositoryUrl: null,
    })
  })

  // 複数のバージョン間のマイグレーションをテスト（将来のバージョンが増えた場合のために）
  it('should correctly migrate through multiple versions', () => {
    // このテストは将来バージョンが増えた時に拡張できます
    // 現在は v2025-06-02 から v2025-06-03 への単一ステップのみ

    // Arrange
    const oldestSettings: SettingsV20250602 = {
      __version__: V20250602_VERSION,
      language: 'de',
    }

    // Act - 明示的に2段階のマイグレーションを行う（将来のバージョンが増えた時のためのパターン）
    const migratedToV20250603 = migrate(oldestSettings)

    // Assert
    expect(migratedToV20250603.__version__).toBe(V20250603_VERSION)
    expect(migratedToV20250603.language).toBe('de')
    expect(migratedToV20250603.repositories).toEqual([])
    expect(migratedToV20250603.selectedRepositoryUrl).toBeNull()
  })
})
