---
title: "Model & Benchmark Synchronization Policy"
description: "Dual synchronization of supported_models.md, benchmark script and frontend model registry."
category: "rules"
type: "specification"
status: "active"
date: 2026-10-03
updated: 2026-10-03
lang: "en"
tags:
  - "rules"
  - "models"
  - "benchmarks"
alwaysApply: true
---
# 🤖 AI Model & Benchmark Synchronization Policy (.agents/rules/model-benchmark-management.md)

All AI agents (Antigravity, Gemini, Claude Code, Cursor, Copilot Workspace, etc.) operating in this repository **MUST** adhere to this synchronization rule whenever AI models are added, updated, deprecated, or retired in GitHub Copilot.

---

## 1. Specification-Code Dual Synchronization (仕様・コード二重同期の原則)

Whenever AI models or benchmark metrics change, specification documents and operational code must **ALWAYS** be updated in tandem. Under no circumstances should one be updated without the other.

### Synchronized File Matrix

| Category | File Path | Responsibility |
| :--- | :--- | :--- |
| **Specifications & Reference** | `supported_models.md` | Primary reference for Copilot GA/Preview models, Auto Selection eligibility, Extended capabilities (1M tokens, Reasoning), IDE/Client matrices, Minimum IDE versions, Plan availability, and Retirement history. |
| **Benchmark Script** | `scripts/update-benchmarks.ts` | Benchmark metric definitions, capabilities, provider attribution, context limits, pricing, and score updates. |
| **Frontend Model Registry** | `dashboard/src/data/models.ts` | UI catalog, recommended model presets (e.g., Code Review, Architecture, Cost-Performance), and comparison groups. |
| **Architecture Specifications** | `docs/specifications/*` | Architectural decisions, feature specifications, and SDD documentation. |

---

## 2. Model Lifecycle Checklist

When introducing a new model or updating an existing model:

### Step 1: `supported_models.md` Verification
- [ ] Add the model to **でサポートされている AI モデル Copilot** (Table 1: Provider & Lifecycle status GA/Preview).
- [ ] Update **でサポートされている AI モデル Auto model selection** (Table 2: Eligibility & Fallback behavior).
- [ ] Update **拡張機能を備えたモデル** (Table 3: 1M context window & Configurable reasoning).
- [ ] Update **クライアントごとにサポートされている AI モデル** (Table 4: VS Code, Visual Studio, JetBrains, Xcode, Eclipse, CLI, GitHub.com).
- [ ] Update **最近のモデルの最小 IDE バージョン** (Table 5: Minimum version per IDE).
- [ ] Update **Copilot プランごとにサポートされる AI モデル** (Table 6: Pro, Pro+, Max, Business, Enterprise).
- [ ] If a model is deprecated/retired, record the end-of-support date and successor model in **モデルリタイアメント履歴** (Table 11).

### Step 2: `scripts/update-benchmarks.ts` Verification
- [ ] Ensure the model identifier, provider, benchmark scores, context window, and pricing are registered.
- [ ] Run benchmark validation or ingestion script to verify schema conformance.

### Step 3: `dashboard/src/data/models.ts` & Presets Verification
- [ ] Verify that model presets (e.g. `設計に推奨`, `コードレビュー利用に推奨`, `コードベース分析`, `実用性能で高コスパ`) reflect the latest GA model lineup.
- [ ] Ensure deprecated models are removed or replaced with successor equivalents according to project requirements.

---

## 3. Automated Ingestion & Agent Discipline

1. **Benchmark Ingestion Agent Responsibility**:
   - The dedicated benchmark ingestion agent (`.agents/benchmark-ingestion.agent.md`) and skill (`skills/benchmark-ingestion/SKILL.md`) **MUST** inspect `supported_models.md` and keep it synchronized when ingesting or updating model data.
2. **Quality Gate Execution**:
   - Every change modifying models or benchmarks must pass the standard quality gate:
     ```bash
     npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build
     ```
