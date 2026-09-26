export class CacheService<T = unknown> {
  private cache = new Map<string, T>();
  private maxEntries: number;

  constructor(maxEntries: number = 50) {
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const val = this.cache.get(key);
    if (val !== undefined) {
      // LRU refresh
      this.cache.delete(key);
      this.cache.set(key, val);
    }
    return val;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first inserted key)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
