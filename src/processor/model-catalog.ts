/**
 * Model catalog (P3-7 / A-13): canonical model IDs with their aliases.
 *
 * Resolution is an exact match on the normalised alias (lower case, letters and digits only).
 * No substring matching: an unknown name resolves to `unknown:<raw>` instead of being
 * mis-assigned to an existing model. Keep in sync with scripts/benchmark-data/benchmark-records.json
 * (every record id and name must resolve to itself; checked by src/tests/model-catalog.test.ts).
 */

export interface ModelCatalogEntry {
  id: string;
  aliases: string[];
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  { id: 'gpt-6-astra', aliases: ['gpt-6-astra', 'GPT-6 Astra', 'GPT-6', 'GPT 6', 'astra'] },
  { id: 'gpt-6-sol', aliases: ['gpt-6-sol', 'GPT-6 Sol'] },
  { id: 'gpt-6-luna', aliases: ['gpt-6-luna', 'GPT-6 Luna'] },
  { id: 'gpt-5-6-sol', aliases: ['gpt-5-6-sol', 'GPT-5.6 Sol'] },
  { id: 'gpt-5-6-terra', aliases: ['gpt-5-6-terra', 'GPT-5.6 Terra'] },
  { id: 'gpt-5-6-luna', aliases: ['gpt-5-6-luna', 'GPT-5.6 Luna'] },
  { id: 'gpt-5-5', aliases: ['gpt-5-5', 'GPT-5.5'] },
  { id: 'gpt-5-4', aliases: ['gpt-5-4', 'GPT-5.4'] },
  { id: 'gpt-5-4-mini', aliases: ['gpt-5-4-mini', 'GPT-5.4 mini'] },
  { id: 'gpt-5-4-nano', aliases: ['gpt-5-4-nano', 'GPT-5.4 nano (Utility)', 'GPT-5.4 nano'] },
  { id: 'gpt-5-3-codex', aliases: ['gpt-5-3-codex', 'GPT-5.3-Codex (LTS)', 'GPT-5.3-Codex', 'GPT-5.3 Codex'] },
  { id: 'gpt-5-mini', aliases: ['gpt-5-mini', 'GPT-5 mini'] },
  { id: 'claude-sonnet-5', aliases: ['claude-sonnet-5', 'Claude Sonnet 5', 'Claude 5 Sonnet', 'claude-5-sonnet'] },
  { id: 'claude-opus-5-5', aliases: ['claude-opus-5-5', 'Claude Opus 5.5'] },
  { id: 'claude-opus-5', aliases: ['claude-opus-5', 'Claude Opus 5', 'Claude 5 Opus'] },
  { id: 'claude-fable-5-1', aliases: ['claude-fable-5-1', 'Claude Fable 5.1 (EFS)', 'Claude Fable 5.1', 'Claude 5.1 Fable'] },
  { id: 'claude-fable-5', aliases: ['claude-fable-5', 'Claude Fable 5 (EFS)', 'Claude Fable 5', 'Claude 5 Fable'] },
  { id: 'claude-opus-4-8', aliases: ['claude-opus-4-8', 'Claude Opus 4.8'] },
  { id: 'claude-opus-4-8-fast', aliases: ['claude-opus-4-8-fast', 'Claude Opus 4.8 (Fast Mode)', 'Claude Opus 4.8 Fast'] },
  { id: 'claude-opus-4-7', aliases: ['claude-opus-4-7', 'Claude Opus 4.7'] },
  { id: 'claude-opus-4-6', aliases: ['claude-opus-4-6', 'Claude Opus 4.6'] },
  { id: 'claude-sonnet-4-6', aliases: ['claude-sonnet-4-6', 'Claude Sonnet 4.6'] },
  { id: 'claude-sonnet-4', aliases: ['claude-sonnet-4', 'Claude Sonnet 4', 'Claude 4 Sonnet'] },
  { id: 'claude-haiku-4-5', aliases: ['claude-haiku-4-5', 'Claude Haiku 4.5', 'Claude 4.5 Haiku'] },
  { id: 'gemini-3-8-flash', aliases: ['gemini-3-8-flash', 'Gemini 3.8 Flash', 'Gemini 3.8'] },
  { id: 'gemini-3-7-flash', aliases: ['gemini-3-7-flash', 'Gemini 3.7 Flash', 'Gemini 3.7'] },
  { id: 'gemini-3-6-flash', aliases: ['gemini-3-6-flash', 'Gemini 3.6 Flash', 'Gemini 3.6'] },
  { id: 'gemini-3-5-flash', aliases: ['gemini-3-5-flash', 'Gemini 3.5 Flash', 'Gemini 3.5'] },
  { id: 'mai-code-1-1-flash', aliases: ['mai-code-1-1-flash', 'MAI-Code-1.1-Flash', 'MAI Code', 'MAI-Code'] },
  { id: 'grok-4-7', aliases: ['grok-4-7', 'Grok 4.7'] },
  { id: 'grok-4-6', aliases: ['grok-4-6', 'Grok 4.6'] },
  { id: 'grok-4-5', aliases: ['grok-4-5', 'Grok 4.5', 'Grok'] },
  { id: 'kimi-k3', aliases: ['kimi-k3', 'Kimi K3'] },
  { id: 'kimi-k2-7-code', aliases: ['kimi-k2-7-code', 'Kimi K2.7 Code', 'Kimi Code'] },
  { id: 'claude-3-7-sonnet', aliases: ['claude-3-7-sonnet', 'Claude 3.7 Sonnet (Hybrid)', 'Claude 3.7 Sonnet'] },
  { id: 'claude-3-5-sonnet', aliases: ['claude-3-5-sonnet', 'Claude 3.5 Sonnet'] },
  { id: 'gpt-4o', aliases: ['gpt-4o', 'GPT-4o (Omni)', 'GPT-4o', 'GPT-4 Omni'] },
  { id: 'gpt-4o-mini', aliases: ['gpt-4o-mini', 'GPT-4o mini'] },
  { id: 'o1', aliases: ['o1', 'OpenAI o1 (Full Reasoning)', 'OpenAI o1', 'o1-full'] },
  { id: 'o3-mini', aliases: ['o3-mini', 'OpenAI o3-mini', 'o3'] },
  { id: 'gemini-2-0-flash', aliases: ['gemini-2-0-flash', 'Gemini 2.0 Flash', 'Gemini Flash'] },
  { id: 'gemini-2-5-pro', aliases: ['gemini-2-5-pro', 'Gemini 2.5 Pro'] },
  { id: 'deepseek-r1', aliases: ['deepseek-r1', 'DeepSeek R1 (Open Reasoning)', 'DeepSeek R1', 'deepseek-reasoner'] },
];
export const UNKNOWN_MODEL_PREFIX = 'unknown:';

/** Lower case, letters and digits only (e.g. "GPT-4o mini" -> "gpt4omini"). */
export function normalizeAliasKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

let aliasIndex: Map<string, string> | null = null;

function getAliasIndex(): Map<string, string> {
  if (aliasIndex) return aliasIndex;
  const index = new Map<string, string>();
  for (const entry of MODEL_CATALOG) {
    for (const alias of [entry.id, ...entry.aliases]) {
      const key = normalizeAliasKey(alias);
      const existing = index.get(key);
      if (existing && existing !== entry.id) {
        throw new Error(`Model catalog alias collision: "${alias}" maps to both ${existing} and ${entry.id}`);
      }
      index.set(key, entry.id);
    }
  }
  aliasIndex = index;
  return index;
}

/**
 * Resolve a raw model name to a canonical ID by exact alias match.
 * Accepted variations (all exact, never substring): case / punctuation, a trailing parenthetical
 * ("Kimi K3 (Moonshot)"), and a trailing release date suffix ("-20250219" / "-2025-02-19").
 * Returns null when the catalog does not know the name.
 */
export function resolveCatalogModelId(rawName: string): string | null {
  const index = getAliasIndex();
  const trimmed = rawName.trim();
  const noParen = trimmed.replace(/\s*[(（][^)）]*[)）]\s*$/, '');
  const noDate = noParen.replace(/[-_ ](\d{8}|\d{4}-\d{2}-\d{2})$/, '');
  for (const candidate of [trimmed, noParen, noDate]) {
    const key = normalizeAliasKey(candidate);
    if (key && index.has(key)) return index.get(key) as string;
  }
  return null;
}

export function isUnknownModelId(id: string): boolean {
  return id.startsWith(UNKNOWN_MODEL_PREFIX);
}
