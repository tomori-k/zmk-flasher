import { invoke } from "@tauri-apps/api/core";

type GitHubAsset = {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
};

type GitHubRelease = {
  tag_name: string;
  name?: string;
  html_url: string;
  published_at?: string;
  assets: GitHubAsset[];
};

const latestReleaseUrl = "https://api.github.com/repos/tomori-k/zmk-config-broccoli/releases/latest";

function hasTauriBackend() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function backendInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (hasTauriBackend()) {
    return invoke<T>(command, args);
  }

  if (command === "scan_devices") {
    return [] as T;
  }

  if (command === "fetch_latest_release") {
    const response = await fetch(latestReleaseUrl, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub release request failed: ${response.status}`);
    }
    const release = (await response.json()) as GitHubRelease;
    return {
      tag_name: release.tag_name,
      name: release.name,
      html_url: release.html_url,
      published_at: release.published_at,
      assets: release.assets
        .filter((asset) => {
          const name = asset.name.toLowerCase();
          return name.endsWith(".uf2") || name.endsWith(".zip");
        })
        .map((asset) => ({
          id: asset.id,
          name: asset.name,
          size: asset.size,
          download_url: asset.browser_download_url,
        })),
    } as T;
  }

  throw new Error("Tauri desktop backend is required.");
}
