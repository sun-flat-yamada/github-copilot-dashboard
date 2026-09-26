import fs from 'node:fs';
import path from 'node:path';
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
 * Node.js / CLI implementation of IMetricsRepository using local filesystem.
 */
export class FsJsonMetricsRepository implements IMetricsRepository {
  private cache = new CacheService<any>(100);
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.cwd();
  }

  private readJson<T>(relativePath: string, isDemoMode: boolean = false): T {
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
        const cleanRel = url.replace(/^\.?\//, '');
        const candidatePaths = [
          path.resolve(this.baseDir, cleanRel),
          path.resolve(this.baseDir, 'dashboard', 'public', cleanRel),
          cleanRel.startsWith('data/')
            ? path.resolve(this.baseDir, 'dashboard', 'public', cleanRel)
            : null,
          path.resolve(this.baseDir, 'dashboard', 'public', 'data', cleanRel.replace(/^data\//, '')),
        ].filter((p): p is string => Boolean(p));

        for (const localPath of candidatePaths) {
          if (fs.existsSync(localPath)) {
            const content = fs.readFileSync(localPath, 'utf-8');
            const data = JSON.parse(content) as T;
            this.cache.set(cacheKey, data);
            return data;
          }
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    throw lastError || new Error(`Failed to read JSON resource from disk: ${relativePath}`);
  }

  async fetchIndex(isDemoMode: boolean = false): Promise<IndexMetadata> {
    return this.readJson<IndexMetadata>('index.json', isDemoMode);
  }

  async fetchScopeData(
    scopeType: AnalysisScopeType,
    key: string,
    isDemoMode: boolean = false
  ): Promise<ScopeAggregatedData> {
    const subDir = scopeType === 'monthly' ? 'monthly' : scopeType === 'daily' ? 'daily' : 'custom';
    const fileName = `${key.replace(/[:\/]/g, '_')}.json`;
    return this.readJson<ScopeAggregatedData>(`${subDir}/${fileName}`, isDemoMode);
  }

  async fetchReportData(month: string, isDemoMode: boolean = false): Promise<MonthlyReportAggregatedData> {
    return this.readJson<MonthlyReportAggregatedData>(`reports/${month}.json`, isDemoMode);
  }

  async fetchDeepAnalysisProfiles(month: string, isDemoMode: boolean = false): Promise<UserUsageProfile[]> {
    try {
      const archive = this.readJson<{ user_profiles?: UserUsageProfile[] }>(
        `deep-analysis/${month}.json`,
        isDemoMode
      );
      return archive.user_profiles || [];
    } catch {
      return [];
    }
  }

  async fetchBenchmarkData(): Promise<BenchmarkDataset> {
    return this.readJson<BenchmarkDataset>('model-benchmarks.json', false);
  }
}
