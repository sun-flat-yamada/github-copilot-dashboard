/**
 * Display name and chart color per model id (shared by the user views).
 *
 * Known ids follow the model catalog (src/processor/model-catalog.ts). Unknown ids never break a chart:
 * they get a stable fallback color derived from the id and show the id as the name.
 */
export interface ModelDisplay {
  name: string;
  color: string;
}

// Provider families share a hue; the shade tells models of one provider apart.
const ANTHROPIC = ['#d97706', '#f59e0b', '#b45309', '#fbbf24'];
const OPENAI = ['#10b981', '#34d399', '#059669', '#6ee7b7'];
const GOOGLE = ['#3b82f6', '#60a5fa', '#2563eb'];

export const MODEL_DISPLAY: Record<string, ModelDisplay> = {
  // latest lineup
  'claude-fable-5-1': { name: 'Claude Fable 5.1', color: ANTHROPIC[2] },
  'claude-opus-5-5': { name: 'Claude Opus 5.5', color: ANTHROPIC[0] },
  'claude-sonnet-5': { name: 'Claude Sonnet 5', color: ANTHROPIC[1] },
  'gpt-6-astra': { name: 'GPT-6 Astra', color: OPENAI[0] },
  'gpt-6-sol': { name: 'GPT-6 Sol', color: OPENAI[2] },
  'gpt-5-4-mini': { name: 'GPT-5.4 mini', color: OPENAI[1] },
  'gemini-3-8-flash': { name: 'Gemini 3.8 Flash', color: GOOGLE[0] },
  'grok-4-7': { name: 'Grok 4.7', color: '#94a3b8' },
  'kimi-k3': { name: 'Kimi K3', color: '#ec4899' },
  // older models that may still appear in stored history
  'claude-sonnet-4': { name: 'Claude Sonnet 4', color: ANTHROPIC[3] },
  'claude-3-7-sonnet': { name: 'Claude 3.7 Sonnet', color: ANTHROPIC[3] },
  'gpt-4o': { name: 'GPT-4o', color: OPENAI[3] },
  o1: { name: 'o1', color: '#6366f1' },
  'gemini-2-0-flash': { name: 'Gemini 2.0 Flash', color: GOOGLE[1] },
};

const FALLBACK_COLORS = ['#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#a855f7', '#64748b'];

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function getModelDisplay(id: string): ModelDisplay {
  return MODEL_DISPLAY[id] ?? { name: id, color: FALLBACK_COLORS[hash(id) % FALLBACK_COLORS.length] };
}

export function getModelColor(id: string): string {
  return getModelDisplay(id).color;
}
