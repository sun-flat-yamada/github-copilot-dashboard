---
name: sns-buzz-harvester
description: Gather and synthesize authentic engineer sentiments, community rumors, and practical caveats across tech social platforms (X/Twitter, Reddit, Hacker News) for AI models.
---

# 💬 SNS Buzz & Engineer Sentiment Harvester Skill

Use this skill to research, summarize, and update real-world developer sentiment and community buzz (`EngineerBuzz`) for each AI model in the Benchmark Radar.

---

## 🎯 Purpose & Compliance

While official benchmarks offer standardized numerical scores, production software development requires understanding practical real-world nuances:
- Where models struggle in real repositories (syntax nuances, CSS, framework versions).
- Stream latency feelings vs. theoretical TPS.
- Subtle prompting quirks or instruction-following degradations.

> [!IMPORTANT]
> **Source Note Requirement**:
> All social sentiments must carry the explicit annotation:
> `※ SNS上のエンジニアの声・コミュニティの噂・所感` to distinguish them from verified academic benchmarks.
> **Zero PII Rule**: Never mention individual developer names, account handles (@user), or private company internal structures.

---

## 📝 Sentiment Profile Schema (`EngineerBuzz`)

export interface BuzzSource {
  title: string;
  url: string;
}

export interface EngineerBuzz {
  headline: string; // e.g. "2026年フロントエンド自律実装のデファクトスタンダード"
  community_sentiments: string[]; // 3-4 bullet points of positive production feedback
  caution_rumor: string; // 1-2 cautionary nuances or community gripes
  source_note: string; // "※ SNS上のエンジニアの声・コミュニティの噂・所感"
  sources?: BuzzSource[]; // 引用元・参考記事等のURL一覧
}
```

---

## 🔍 Collection & Distillation Checklist

1. **Headline Formulation**: Capture the model's prevailing nickname or reputation in 1 clear phrase.
2. **Community Sentiments**:
   - Focus on concrete engineering tasks (e.g. "Next.js App Routerの型定義を崩さずリファクタできる", "長い思考時間（CoT）の末に提示される回答の納得度が高い").
3. **Caution & Rumors**:
   - Highlight practical friction (e.g. "思考待機時間が長めでインライン補完としてはテンポが崩れる", "キャッシュが切れると初動コストが跳ね上がる").
4. **Integration**:
   - Update `MODEL_ENGINEER_BUZZ` dictionary in `src/processor/benchmark-evaluator.ts`.
   - Run tests: `npm test`.
