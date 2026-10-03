import { z } from 'zod';
import { FACT_SCHEMAS, FACT_SCHEMA_VERSION, FactName } from './schemas.js';

/** `fact.usage_user_daily` → `fact.usage_user_daily.v1.schema.json` */
export function factSchemaFileName(name: FactName): string {
  return `${name}.v${FACT_SCHEMA_VERSION}.schema.json`;
}

/** zod から JSON Schema (draft 2020-12) を生成し、決定的な文字列にして返す */
export function generateFactJsonSchemas(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(FACT_SCHEMAS) as FactName[]) {
    const schema = z.toJSONSchema(FACT_SCHEMAS[name], { target: 'draft-2020-12' });
    out[factSchemaFileName(name)] = JSON.stringify({ title: name, ...schema }, null, 2) + '\n';
  }
  return out;
}
