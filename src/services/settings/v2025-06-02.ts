// This is the first version of settings, so no migrations are needed
export const VERSION = '2025-06-02' as const
export type VersionV20250602 = typeof VERSION

export interface SettingsV20250602 {
  __version__: VersionV20250602
  language: string
}

// Default settings for this version
export const DEFAULT_SETTINGS: SettingsV20250602 = {
  __version__: VERSION,
  language: 'en', // Default language is English
}
