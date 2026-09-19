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

/**
 * スコープデータやレポートファイルの解決候補 URL 一覧を生成
 * (直下パス -> processed/ 階層パス -> 反対モードの直下パス -> 反対モードの processed/ 階層パス)
 */
export function getCandidateDataUrls(
  baseDir: string,
  subDir: string,
  fileName: string
): string[] {
  const isDemo = baseDir.includes('/demo') || baseDir.endsWith('demo');
  const altBaseDir = isDemo ? './data' : './data/demo';

  const candidates = [
    // 1. 指定ベースディレクトリ直下のパス (標準SPA配置)
    resolveDataPath(`${baseDir}/${subDir}/${fileName}`),
    // 2. 永続ストレージの processed/ サブディレクトリ配下 (copilot-data 同期時の後方互換)
    resolveDataPath(`${baseDir}/processed/${subDir}/${fileName}`),
    // 3. 代替モードの直下パス (DEMO <=> LIVE 双方向フォールバック)
    resolveDataPath(`${altBaseDir}/${subDir}/${fileName}`),
    // 4. 代替モードの processed/ パス
    resolveDataPath(`${altBaseDir}/processed/${subDir}/${fileName}`),
  ];

  // 重複を除去して返す
  return Array.from(new Set(candidates));
}

/**
 * 複数の候補 URL を順次フェッチし、最初に応答成功 (200 OK) した結果を返すヘルパー
 */
export async function fetchDataWithFallback(candidateUrls: string[]): Promise<{
  res: Response;
  finalUrl: string;
  isFallback: boolean;
}> {
  let lastRes: Response | null = null;
  for (let i = 0; i < candidateUrls.length; i++) {
    const url = candidateUrls[i];
    try {
      const res = await fetch(url);
      if (res.ok) {
        return {
          res,
          finalUrl: url,
          isFallback: i > 0,
        };
      }
      lastRes = res;
    } catch {
      // ネットワーク例外は次の候補へフォールバック
    }
  }
  if (lastRes) {
    return {
      res: lastRes,
      finalUrl: candidateUrls[0],
      isFallback: false,
    };
  }
  throw new Error(`Failed to fetch from all candidates: ${candidateUrls.join(', ')}`);
}
