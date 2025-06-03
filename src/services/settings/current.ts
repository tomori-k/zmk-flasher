import * as fs from '@tauri-apps/plugin-fs'
import * as path from '@tauri-apps/api/path'
import { SettingsV20250602, VERSION as V20250602_VERSION } from './v2025-06-02'
import {
  SettingsV20250603,
  VERSION as V20250603_VERSION,
  DEFAULT_SETTINGS as DEFAULT_V20250603,
  migrateFromPrevious as migrateV20250602ToV20250603,
} from './v2025-06-03'

// Define a type for any settings object
export type AnySettings = SettingsV20250602 | SettingsV20250603

// The current settings type is the latest version
export type Settings = SettingsV20250603

export type SettingsWithoutVersion = Omit<Settings, 'version'>

// Export the latest version code
export const LATEST_VERSION = V20250603_VERSION

// Export the default settings for the current version
export const LATEST_DEFAULT_SETTINGS = DEFAULT_V20250603

/**
 * Helper function to read a settings file
 * @param version Version string for the settings file
 * @returns Settings object or null if file doesn't exist
 * @throws Error if file cannot be read or parsed
 */
async function readSettingsFile(): Promise<unknown | null> {
  const appDirPath = await path.appDataDir()
  const settingsPath = await path.join(appDirPath, 'settings.json')

  // Check if file exists
  const exists = await fs.exists(settingsPath)
  if (!exists) {
    return null
  }

  // Read and parse settings file
  // エンコードは UTF-8 がデフォルトらしい。
  // https://github.com/tauri-apps/plugins-workspace/issues/941
  const content = await fs.readTextFile(settingsPath)
  return JSON.parse(content)
}

/**
 * Helper function to write a settings file
 * @param version Version string for the settings file
 * @param settings Settings object to save
 * @throws Error if file cannot be written
 */
async function writeSettingsFile(settings: any): Promise<void> {
  const appDirPath = await path.appDataDir()
  const settingsPath = await path.join(appDirPath, 'settings.json')

  // Create app directory if it doesn't exist
  await fs.mkdir(appDirPath, { recursive: true })

  // Write settings to file
  await fs.writeTextFile(settingsPath, JSON.stringify(settings, null, 2))
}

/**
 * Migrate settings from one version to the next
 * @param settings Settings object to migrate
 * @returns Migrated settings object
 * @throws Error if migration fails or version is not supported
 */
export function migrate(settings: AnySettings): Settings {
  switch (settings.version) {
    case V20250602_VERSION:
      return migrate(migrateV20250602ToV20250603(settings))
    case V20250603_VERSION:
      return settings
  }
}

/**
 * Load settings from storage, migrating from older versions if necessary
 * @returns Current settings or default settings if none exist
 * @throws Error if settings cannot be loaded or migrated
 */
export async function loadSettings(): Promise<SettingsWithoutVersion> {
  try {
    // Read the settings file
    const settings = await readSettingsFile()

    // Zod とかでバリデーションするともっと安全になりそうだけどめんどくさいので、簡易的なチェックだけにする
    if (
      settings == null ||
      typeof settings !== 'object' ||
      !('version' in settings)
    ) {
      throw new Error('Invalid settings file')
    }

    return migrate(settings as AnySettings)
  } catch (error) {
    console.error(error)
    return LATEST_DEFAULT_SETTINGS
  }
}

/**
 * Save settings to storage
 * @param settings Settings to save
 * @throws Error if settings cannot be saved
 */
export async function saveSettings(
  settings: SettingsWithoutVersion
): Promise<void> {
  await writeSettingsFile({ ...settings, version: LATEST_VERSION })
}
