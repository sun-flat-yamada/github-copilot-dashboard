/**
 * Data Path Resolver Utility
 * 
 * GitHub Pages (サブディレクトリ展開かつ末尾スラッシュの有無) や
 * ローカル開発環境、カスタムドメインにおいて、常に正確な相対/絶対パスを
 * 解決するためのユーティリティ。
 */

export function resolveDataPath(relativePath: string): string {
  // 先頭の ./ や / を取り除いてクリーンな相対パスにする
  const cleanRelative = relativePath.replace(/^\.?\//, '');

  if (typeof window === 'undefined') {
    return `./${cleanRelative}`;
  }

  // ViteのBASE_URL環境変数が絶対パス（例: '/github-copilot-dashboard/'）で指定されている場合
  const envBase = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || './';
  if (envBase.startsWith('/') && envBase !== '/') {
    const trimmedBase = envBase.endsWith('/') ? envBase : `${envBase}/`;
    return `${trimmedBase}${cleanRelative}`;
  }

  // GitHub Pagesなどのサブディレクトリホスティング環境において、
  // ユーザーが末尾スラッシュなし (例: /github-copilot-dashboard) でアクセスした場合、
  // 通常の相対パス './data/...' だとドメインルート '/data/...' に解決されて404になる。
  // そのため、window.location.pathname からディレクトリベースパスを算出して結合する。
  const pathname = window.location.pathname;
  if (pathname && pathname !== '/') {
    // pathnameがファイル名で終わっているかチェック (例: /repo/index.html)
    const isFile = /\.[a-zA-Z0-9]+$/.test(pathname);
    const dirPath = isFile
      ? pathname.substring(0, pathname.lastIndexOf('/') + 1)
      : pathname.endsWith('/')
      ? pathname
      : `${pathname}/`;
    return `${dirPath}${cleanRelative}`;
  }

  return `./${cleanRelative}`;
}

/**
 * DEMO パスと通常パスの双方向フォールバック解決用ヘルパー
 */
export function getAlternateDataPath(primaryPath: string): string {
  if (primaryPath.includes('/demo/')) {
    return primaryPath.replace('/demo/', '/');
  }
  if (primaryPath.startsWith('demo/')) {
    return primaryPath.replace(/^demo\//, '');
  }
  if (primaryPath.includes('data/demo')) {
    return primaryPath.replace('data/demo', 'data');
  }
  if (primaryPath.includes('data/')) {
    return primaryPath.replace('data/', 'data/demo/');
  }
  return primaryPath;
}
