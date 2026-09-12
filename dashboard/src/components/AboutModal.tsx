import React, { useEffect } from 'react';
import { IndexMetadata } from '../../../src/types/copilot';
import {
  X,
  Clock,
  GitFork,
  ExternalLink,
  Database,
  Users,
  Layers,
  Sparkles,
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  indexMeta: IndexMetadata | null;
  repoInfo: {
    owner: string;
    name: string;
    url: string;
    isFork: boolean;
  };
}

export function formatAnalysisDate(dateString?: string): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  indexMeta,
  repoInfo,
}) => {
  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedDate = formatAnalysisDate(indexMeta?.generated_at);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="about-modal-title" className="text-base font-bold text-white tracking-tight">
                About GitHub Copilot Analytics
              </h2>
              <p className="text-xs text-slate-400">システム情報 & 分析メタデータ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ本体 */}
        <div className="p-6 space-y-4 text-xs">
          {/* 1. 分析ページ作成日時 (Prominent Card) */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-indigo-900/60 text-indigo-300 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider block">
                分析ページ作成日時
              </span>
              <div className="mt-1 font-mono text-sm sm:text-base font-bold text-white tracking-wide">
                {formattedDate}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                GitHub Actions パイプラインによって最新データが集計・同期されたタイムスタンプです。
              </p>
            </div>
          </div>

          {/* 2. バージョン & リポジトリ情報 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* バージョン情報 */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex items-start space-x-3">
              <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 mt-0.5">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-slate-400 block font-medium">仕様バージョン</span>
                <span className="text-slate-200 font-semibold text-xs mt-0.5 inline-block">
                  2026.09 LTS
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  GitHub Enterprise 3-Axis Allocation
                </span>
              </div>
            </div>

            {/* 生成元リポジトリ */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 flex items-start space-x-3">
              <div className="p-1.5 rounded-lg bg-slate-800 text-slate-400 mt-0.5">
                <GitFork className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">生成元リポジトリ</span>
                  {repoInfo.isFork && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      Fork
                    </span>
                  )}
                </div>
                <a
                  href={repoInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 font-mono text-xs font-semibold mt-0.5 inline-flex items-center space-x-1 truncate max-w-full group"
                >
                  <span className="truncate">{repoInfo.owner}/{repoInfo.name}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </a>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  GitHub Pages ソースコード
                </span>
              </div>
            </div>
          </div>

          {/* 3. データ保持 & 座席概要 */}
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-slate-300">
              <div className="flex items-center space-x-2">
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>データ保持期間:</span>
              </div>
              <span className="font-semibold text-slate-200">
                {indexMeta?.data_retention_days || 365} 日間 (copilot-data 分離ブランチ)
              </span>
            </div>

            {indexMeta?.summary && (
              <div className="flex items-center justify-between text-slate-300 pt-2 border-t border-slate-800/80">
                <div className="flex items-center space-x-2">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>管理ライセンス数:</span>
                </div>
                <span className="font-semibold text-slate-200">
                  総数 {indexMeta.summary.total_seats} 席 / アクティブ {indexMeta.summary.active_seats_30d} 席
                </span>
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
