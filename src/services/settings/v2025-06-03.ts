import { Repository } from '@/types/types'
import { SettingsV20250602 } from './v2025-06-02'

// This is the second version of settings, including repositories
export const VERSION = '2025-06-03' as const
export type VersionV20250603 = typeof VERSION

export interface SettingsV20250603 {
  version: VersionV20250603
  language: string
  repositories: Repository[]
  selectedRepositoryUrl: string | null
}

// Default settings for this version
export const DEFAULT_SETTINGS: SettingsV20250603 = {
  version: VERSION,
  language: 'en',
  repositories: [],
  selectedRepositoryUrl: null,
}

/**
 * Migrate from previous version
 * @param prevSettings Previous version settings
 * @returns New version settings
 */
export function migrateFromPrevious(
  prevSettings: SettingsV20250602
): SettingsV20250603 {
  return {
    ...DEFAULT_SETTINGS,
    language: prevSettings.language,
    // New fields are initialized with default values
  }
}
