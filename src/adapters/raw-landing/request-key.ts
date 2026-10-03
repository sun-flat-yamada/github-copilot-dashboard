/**
 * リクエストの正準キー。録画と再生で同じ文字列になる必要がある。
 * ベース URL と認証には依存せず、エンドポイント (パラメータ解決後) と並べ替えたクエリだけで決まる。
 */
export function canonicalRequestKey(
  endpoint: string,
  params: Record<string, string> = {},
  query: Record<string, string | number> = {}
): string {
  let path = endpoint;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }
  if (!path.startsWith('/')) path = `/${path}`;
  const pairs = Object.entries(query)
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const qs = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `GET ${path}${qs ? `?${qs}` : ''}`;
}

/**
 * 署名付き URL から署名 (クエリ・フラグメント) を除いた形。
 * 署名は有効期限付きの資格情報なので保存しない。ダウンロードのキーはホスト + パスだけで決める。
 */
export function stripSignature(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

export const downloadKey = (url: string): string => `GET ${stripSignature(url)}`;
