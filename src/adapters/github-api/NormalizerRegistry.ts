import { NormalizerFn } from './ResponseNormalizer.js';
import { DEFAULT_API_VERSION } from './api-compatibility.js';

export class NormalizerRegistry<TRaw = unknown, TNormalized = unknown> {
  private normalizers = new Map<string, NormalizerFn<TRaw, TNormalized>>();
  private defaultNormalizerFn?: NormalizerFn<TRaw, TNormalized>;

  register(apiVersion: string, normalizer: NormalizerFn<TRaw, TNormalized>): void {
    this.normalizers.set(apiVersion, normalizer);
    if (!this.defaultNormalizerFn || apiVersion === DEFAULT_API_VERSION) {
      this.defaultNormalizerFn = normalizer;
    }
  }

  getNormalizer(apiVersion: string): NormalizerFn<TRaw, TNormalized> {
    const normalizer = this.normalizers.get(apiVersion);
    if (normalizer) return normalizer;

    if (this.defaultNormalizerFn) {
      return this.defaultNormalizerFn;
    }

    throw new Error(`No normalizer registered for API version: ${apiVersion} and no default available`);
  }

  has(apiVersion: string): boolean {
    return this.normalizers.has(apiVersion);
  }
}
