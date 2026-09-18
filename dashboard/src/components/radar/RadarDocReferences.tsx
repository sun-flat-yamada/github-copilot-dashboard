import React from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';

export const RadarDocReferences: React.FC = () => {
  return (
    <div id="radar-references" className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl scroll-mt-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center space-x-2 text-sm font-bold text-white">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <span>GitHub Copilot 公式ドキュメント・仕様リファレンス引用</span>
        </div>
        <span className="text-[11px] text-slate-400">
          公式仕様・サポートモデル一覧・課金体系への直接リンク
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* 引用1: サポートモデル一覧 */}
        <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3 hover:border-indigo-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <h4 className="font-bold text-white text-sm">GitHub Copilot サポートAIモデル一覧</h4>
              </div>
              <a
                href="https://docs.github.com/ja/copilot/reference/ai-models/supported-models"
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-colors flex items-center space-x-1"
                title="公式ドキュメントを開く"
              >
                <span className="text-[11px] font-semibold">公式Doc</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              GitHub Copilot のエージェントモード、コード補完、Chat で利用可能な各社（Anthropic, OpenAI, Google, Microsoft, DeepSeek, xAI, Moonshot AI）の全モデル一覧と、Tier分類（Powerful, Versatile, Lightweight）、提供ステータス（GA, LTS, Preview）の公式リファレンスです。
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-indigo-300/80 font-mono truncate">
            URL: https://docs.github.com/ja/copilot/reference/ai-models/supported-models
          </div>
        </div>

        {/* 引用2: モデル別課金・単価表 */}
        <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3 hover:border-indigo-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <h4 className="font-bold text-white text-sm">GitHub Copilot モデル別課金・単価表 (Models and Pricing)</h4>
              </div>
              <a
                href="https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing"
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-indigo-400 hover:text-white transition-colors flex items-center space-x-1"
                title="公式価格表を開く"
              >
                <span className="text-[11px] font-semibold">公式価格表</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              各モデルの 100万トークン（1M tokens）あたりの Input / Output 課金単価、Prompt Caching（キャッシュ読み取り・書き込み）割引単価、超長文コンテキスト（Long Context &gt; 128K/200K）価格体系、およびコンテキスト窓容量（128K〜1M）の公式料金規定です。
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-indigo-300/80 font-mono truncate">
            URL: https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing
          </div>
        </div>
      </div>
    </div>
  );
};
