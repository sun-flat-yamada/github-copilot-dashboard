import fs from 'node:fs';
import path from 'node:path';
import { generateFactJsonSchemas } from '../src/domain/facts/json-schema.js';

/** 正準ファクトの JSON Schema を docs/schemas/facts/ に書き出す。`--check` は差分があれば失敗する */
const outDir = path.resolve('docs/schemas/facts');
const generated = generateFactJsonSchemas();

if (process.argv.includes('--check')) {
  const stale = Object.entries(generated).filter(([name, body]) => {
    const file = path.join(outDir, name);
    return !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body;
  });
  if (stale.length > 0) {
    console.error(`Stale fact schemas: ${stale.map(([n]) => n).join(', ')}. Run: npm run schema:facts`);
    process.exit(1);
  }
  console.log(`Fact schemas up to date (${Object.keys(generated).length}).`);
} else {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, body] of Object.entries(generated)) fs.writeFileSync(path.join(outDir, name), body);
  console.log(`Wrote ${Object.keys(generated).length} schemas to docs/schemas/facts/`);
}
