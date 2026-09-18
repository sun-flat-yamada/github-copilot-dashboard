import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadUserMappingFromFile } from '../collector/mapping-file-loader.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';

// loadUserMappingFromFile は、GitHub Secrets/Variables の48KBサイズ上限を超える
// 大規模ユーザーマッピングを扱うための GPG暗号化ワークアラウンド (docs/specifications/04 第6章) で
// src/cli/run-pipeline.ts から利用される、COPILOT_USER_MAPPING_FILE 経由のファイル読み込みヘルパー。
// (ブラウザにバンドルされる attribute-resolver.ts 自体にはこの fs 依存を持ち込まない設計)

function makeTempMappingFile(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapping-file-loader-test-'));
  const filePath = path.join(dir, 'mapping.json');
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('loadUserMappingFromFile', () => {
  it('returns undefined when filePath is undefined or blank', () => {
    assert.strictEqual(loadUserMappingFromFile(undefined), undefined);
    assert.strictEqual(loadUserMappingFromFile(''), undefined);
    assert.strictEqual(loadUserMappingFromFile('   '), undefined);
  });

  it('reads and returns the file contents when the file exists', () => {
    const content = JSON.stringify([{ github_user: 'dev_carol', display_name: 'Carol C.' }]);
    const filePath = makeTempMappingFile(content);
    try {
      assert.strictEqual(loadUserMappingFromFile(filePath), content);
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  it('returns undefined (with a warning) when the file does not exist', () => {
    const missingPath = path.join(os.tmpdir(), 'this-file-should-not-exist-12345.json');
    assert.strictEqual(loadUserMappingFromFile(missingPath), undefined);
  });

  it('composes with AttributeResolver exactly as run-pipeline.ts does (COPILOT_USER_MAPPING_FILE workaround end-to-end)', () => {
    const filePath = makeTempMappingFile(
      JSON.stringify([{ github_user: 'dev_erin', display_name: 'Erin E.', department: 'Data Platform' }])
    );
    try {
      const resolver = new AttributeResolver(loadUserMappingFromFile(filePath));
      const resolved = resolver.resolve('dev_erin');
      assert.strictEqual(resolved.displayName, 'Erin E.');
      assert.strictEqual(resolved.department, 'Data Platform');
    } finally {
      fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
    }
  });

  it('AttributeResolver falls back to COPILOT_USER_MAPPING when the file is missing', () => {
    const missingPath = path.join(os.tmpdir(), 'this-file-should-not-exist-67890.json');
    const savedEnv = process.env.COPILOT_USER_MAPPING;
    try {
      process.env.COPILOT_USER_MAPPING = JSON.stringify([{ github_user: 'dev_frank', display_name: 'Frank F.' }]);
      const resolver = new AttributeResolver(loadUserMappingFromFile(missingPath));
      const resolved = resolver.resolve('dev_frank');
      assert.strictEqual(resolved.displayName, 'Frank F.');
    } finally {
      if (savedEnv === undefined) {
        delete process.env.COPILOT_USER_MAPPING;
      } else {
        process.env.COPILOT_USER_MAPPING = savedEnv;
      }
    }
  });
});
