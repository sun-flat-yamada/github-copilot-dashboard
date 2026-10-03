import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RunManifest } from '../../domain/entities/run-manifest.js';

/** `data/raw/landing/` 配下の不変ストア。応答本文は内容ハッシュ名で保存し、同じ内容は再保存しない */
export class RawLandingStore {
  readonly root: string;

  constructor(baseDir: string) {
    this.root = path.join(baseDir, 'raw', 'landing');
  }

  static newRunId(now: Date = new Date()): string {
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
  }

  /** 本文を保存する。既に同じ内容があれば何もしない (不変・重複排除)。root からの相対パスを返す */
  putObject(content: string, ext: string): { object: string; sha256: string; bytes: number } {
    const sha256 = crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
    const rel = path.posix.join('objects', sha256.slice(0, 2), `${sha256}.${ext}`);
    const file = path.join(this.root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      fs.writeFileSync(file, content, { encoding: 'utf-8', flag: 'wx' });
    } catch (err: any) {
      if (err?.code !== 'EEXIST') throw err;
    }
    return { object: rel, sha256, bytes: Buffer.byteLength(content, 'utf-8') };
  }

  readObject(rel: string): string {
    const file = path.resolve(this.root, rel);
    // manifest が指す先は root 配下のみ (改ざんされた manifest によるパス脱出を防ぐ)
    if (!file.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error(`Raw landing object path escapes the landing root: ${rel}`);
    }
    return fs.readFileSync(file, 'utf-8');
  }

  /** manifest は run ごとに 1 回だけ書く (上書きしない) */
  writeManifest(manifest: RunManifest): string {
    const dir = path.join(this.root, 'manifests');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${manifest.run_id}.json`);
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2), { encoding: 'utf-8', flag: 'wx' });
    return file;
  }

  listRunIds(): string[] {
    const dir = path.join(this.root, 'manifests');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .sort();
  }

  latestRunId(): string | null {
    const ids = this.listRunIds();
    return ids.length > 0 ? ids[ids.length - 1] : null;
  }

  readManifest(runId: string): RunManifest {
    if (!/^[0-9A-Za-z-]+$/.test(runId)) throw new Error(`Invalid run id: ${runId}`);
    const file = path.join(this.root, 'manifests', `${runId}.json`);
    if (!fs.existsSync(file)) throw new Error(`Run manifest not found: ${runId}`);
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as RunManifest;
  }
}
