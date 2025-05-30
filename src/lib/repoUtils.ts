/**
 * GitHub URLからオーナー名とリポジトリ名を抽出します
 * @param url GitHub リポジトリのURL
 * @returns オーナー名とリポジトリ名の配列、無効なURLの場合はnull
 */
export function extractRepoInfo(
  url: string
): { owner: string; repo: string } | null {
  const githubRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)/
  const match = url.match(githubRegex)

  if (!match) {
    return null
  }

  return {
    owner: match[1],
    repo: match[2],
  }
}

/**
 * リポジトリURLからリポジトリの表示名を生成します
 * @param url GitHub リポジトリのURL
 * @returns 表示名（owner/repo形式）、無効なURLの場合はURL自体を返します
 */
export function getRepoDisplayName(url: string): string {
  const repoInfo = extractRepoInfo(url)
  if (!repoInfo) {
    return url
  }
  return `${repoInfo.owner}/${repoInfo.repo}`
}

/**
 * URLが有効なGitHub URLかどうかを検証します
 * @param url 検証するURL
 * @returns 有効なGitHub URLの場合はtrue、それ以外はfalse
 */
export function isValidGithubUrl(url: string): boolean {
  return extractRepoInfo(url) !== null
}
