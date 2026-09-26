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

/**
 * Pure Browser / HTTP implementation of IMetricsRepository.
 * Zero dependency on Node.js core modules (fs, path).
 */
export class HttpJsonMetricsRepository implements IMetricsRepository {
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
        const response = await fetch(url);
        if (response.ok) {
          const data = (await response.json()) as T;
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
