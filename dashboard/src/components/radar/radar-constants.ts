/**
 * AI Model Radar プリセット定義 (2026年 GitHub Copilot公式モデル・カテゴリ別・メーカー別)
 */
export interface RadarPreset {
  id: string;
  name: string;
  description: string;
  modelIds: string[];
}

export const PRESETS: RadarPreset[] = [
  {
    id: 'flagship-2026',
    name: '🌟 2026上 旗艦4選',
    description: 'Claude Opus 5 / GPT-6 Astra / Gemini 3.8 Flash / Kimi K3 (2026年上期 各社最前線フラッグシップ — Powerful Tier 代表スナップショット)',
    modelIds: ['claude-opus-5', 'gpt-6-astra', 'gemini-3-8-flash', 'kimi-k3'],
  },
  {
    id: 'practical-high-value',
    name: '💡 実用性能で高コスパ',
    description: 'Claude Sonnet 5 / Gemini 3.8 Flash / GPT-5.6 Luna / Kimi K2.7 Code (実用コーディング性能と抜群の費用対効果を両立)',
    modelIds: ['claude-sonnet-5', 'gemini-3-8-flash', 'gpt-5-6-luna', 'kimi-k2-7-code'],
  },
  {
    id: 'recommended-code-review',
    name: '🔍 コードレビュー利用に推奨',
    description: 'Claude Opus 5 / Claude Sonnet 5 / Gemini 3.8 Flash (最高水準の推論・SWE性能を維持したコスト別上位3選)',
    modelIds: ['claude-opus-5', 'claude-sonnet-5', 'gemini-3-8-flash'],
  },
  {
    id: 'recommended-codebase-analysis',
    name: '📂 コードベース分析に推奨',
    description: 'Claude Opus 5 / Claude Sonnet 5 / Gemini 3.8 Flash (1Mコンテキスト・大域的設計把握のコスト別上位3選)',
    modelIds: ['claude-opus-5', 'claude-sonnet-5', 'gemini-3-8-flash'],
  },
  {
    id: 'recommended-architecture',
    name: '🏛️ 設計に推奨',
    description: 'GPT-6 Astra / Claude Sonnet 5 / Gemini 3.8 Flash (極限論理推論・アーキテクチャ把握のコスト別上位3選)',
    modelIds: ['gpt-6-astra', 'claude-sonnet-5', 'gemini-3-8-flash'],
  },
  {
    id: 'tier-powerful',
    name: '⚡ Powerful (最上位推論)',
    description: 'GPT-6 Astra / Claude Opus 5 / GPT-5.6 Sol / Kimi K3 (最高峰コーディング・推論群)',
    modelIds: ['gpt-6-astra', 'claude-opus-5', 'gpt-5-6-sol', 'kimi-k3'],
  },
  {
    id: 'tier-versatile',
    name: '🛠️ Versatile (実務バランス)',
    description: 'Claude Sonnet 5 / GPT-5.6 Terra / Gemini 3.8 Flash / Grok 4.6 (標準実務・俊敏性重視)',
    modelIds: ['claude-sonnet-5', 'gpt-5-6-terra', 'gemini-3-8-flash', 'grok-4-6'],
  },
  {
    id: 'tier-lightweight',
    name: '🚀 Lightweight (超高速・低コスト)',
    description: 'GPT-5.6 Luna / Gemini 3.5 Flash / MAI-Code-1.1-Flash / GPT-5.4 mini (日常インライン・超高速補完)',
    modelIds: ['gpt-5-6-luna', 'gemini-3-5-flash', 'mai-code-1-1-flash', 'gpt-5-4-mini'],
  },
  {
    id: 'vendor-anthropic',
    name: '🟠 Anthropic 主力',
    description: 'Claude Sonnet 5 / Claude Opus 5 / Claude Fable 5.1 / Claude Haiku 4.5 (Anthropic 2026最新)',
    modelIds: ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-haiku-4-5'],
  },
  {
    id: 'vendor-openai',
    name: '🟢 OpenAI 主力',
    description: 'GPT-6 Astra / GPT-5.6 Sol / GPT-5.6 Terra / GPT-5.6 Luna (OpenAI 2026最新ファミリ)',
    modelIds: ['gpt-6-astra', 'gpt-5-6-sol', 'gpt-5-6-terra', 'gpt-5-6-luna'],
  },
  {
    id: 'vendor-google',
    name: '🔵 Google Gemini 3.x',
    description: 'Gemini 3.8 Flash / Gemini 3.7 Flash / Gemini 3.6 Flash / Gemini 3.5 Flash (Google 最新1Mコンテキスト)',
    modelIds: ['gemini-3-8-flash', 'gemini-3-7-flash', 'gemini-3-6-flash', 'gemini-3-5-flash'],
  },
];
