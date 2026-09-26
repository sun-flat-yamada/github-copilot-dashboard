/**
 * PathResolver Adapter (SDD-05 & AGENTS.md Multi-tier Fallback Convention).
 * Resolves static JSON paths across local Vite dev, GitHub Pages subdir deployment, and Node runtime.
 */

export class PathResolver {
  static resolveDataPath(relativePath: string, isDemoMode: boolean = false): string {
    const clean = relativePath.replace(/^\.?\//, '');
    const prefix = isDemoMode ? 'data/demo/' : 'data/';

    // すでに prefix が付いている場合は二重付与を防ぐ
    const target = clean.startsWith('data/') ? clean : `${prefix}${clean}`;

    if (typeof window === 'undefined') {
      return `./${target}`;
    }

    const envBase = (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL) || './';
    if (envBase.startsWith('/') && envBase !== '/') {
      const trimmedBase = envBase.endsWith('/') ? envBase : `${envBase}/`;
      return `${trimmedBase}${target}`;
    }

    const pathname = window.location.pathname;
    if (pathname && pathname !== '/') {
      const isFile = /\.[a-zA-Z0-9]+$/.test(pathname);
      const dirPath = isFile
        ? pathname.substring(0, pathname.lastIndexOf('/') + 1)
        : pathname.endsWith('/')
        ? pathname
        : `${pathname}/`;
      return `${dirPath}${target}`;
    }

    return `./${target}`;
  }

  static getCandidateDataUrls(primaryUrl: string): string[] {
    const candidates = [primaryUrl];
    if (primaryUrl.includes('/demo/')) {
      candidates.push(primaryUrl.replace('/demo/', '/'));
    } else if (primaryUrl.includes('data/')) {
      candidates.push(primaryUrl.replace('data/', 'data/demo/'));
    }
    return candidates;
  }
}
