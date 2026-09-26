import { IMetricsRepository } from '../../domain/ports/IMetricsRepository.js';
import {
  AnalysisScopeType,
  IndexMetadata,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  UserUsageProfile,
} from '../../domain/entities/copilot.js';
import { BenchmarkDataset } from '../../domain/entities/model-benchmark.js';
import { PathResolver } from './PathResolver.js';
import { CacheService } from '../../application/services/CacheService.js';

export class StaticJsonMetricsRepository implements IMetricsRepository {
  private cache = new CacheService<any>(100);

  private async fetchJson<T>(relativePath: string, isDemoMode: boolean = false): Promise<T> {
    const primaryUrl = PathResolver.resolveDataPath(relativePath, isDemoMode);
    const cacheKey = `${isDemoMode ? 'demo:' : 'live:'}${relativePath}`;

    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached as T;
    }

    const candidateUrls = PathResolver.getCandidateDataUrls(primaryUrl);
    let lastError: Error | null = null;

    for (const url of candidateUrls) {
      try {
        let data: T;
        // Node.js 環境で fs が利用可能かつローカルファイルパスの場合
        if (typeof window === 'undefined' && typeof process !== 'undefined') {
          const fs = await import('fs');
          const path = await import('path');
          const cleanRel = url.replace(/^\.?\//, '');
          const localPath = path.resolve(process.cwd(), cleanRel);
          if (fs.existsSync(localPath)) {
            data = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
            this.cache.set(cacheKey, data);
            return data;
          }
        }

        // ブラウザ または HTTP fetch
        const response = await fetch(url);
        if (response.ok) {
          data = (await response.json()) as T;
          this.cache.set(cacheKey, data);
          return data;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error(`Failed to load JSON resource: ${relativePath}`);
  }

  async fetchIndex(isDemoMode: boolean = false): Promise<IndexMetadata> {
    return this.fetchJson<IndexMetadata>('index.json', isDemoMode);
  }

  async fetchScopeData(
    scopeType: AnalysisScopeType,
    key: string,
    isDemoMode: boolean = false
  ): Promise<ScopeAggregatedData> {
    const subDir = scopeType === 'monthly' ? 'monthly' : scopeType === 'daily' ? 'daily' : 'custom';
    const fileName = `${key.replace(/[:\/]/g, '_')}.json`;
    return this.fetchJson<ScopeAggregatedData>(`${subDir}/${fileName}`, isDemoMode);
  }

  async fetchReportData(month: string, isDemoMode: boolean = false): Promise<MonthlyReportAggregatedData> {
    return this.fetchJson<MonthlyReportAggregatedData>(`reports/${month}.json`, isDemoMode);
  }

  async fetchDeepAnalysisProfiles(month: string, isDemoMode: boolean = false): Promise<UserUsageProfile[]> {
    try {
      const archive = await this.fetchJson<{ user_profiles?: UserUsageProfile[] }>(
        `deep-analysis/${month}.json`,
        isDemoMode
      );
      return archive.user_profiles || [];
    } catch {
      return [];
    }
  }

  async fetchBenchmarkData(): Promise<BenchmarkDataset> {
    return this.fetchJson<BenchmarkDataset>('model-benchmarks.json', false);
  }
}
