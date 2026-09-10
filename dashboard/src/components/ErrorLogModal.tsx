import React, { useState } from 'react';
import { DataFetchIssue } from '../../../src/types/copilot';
import {
  AlertTriangle,
  AlertCircle,
  Download,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
} from 'lucide-react';

interface ErrorLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: DataFetchIssue[];
  repoInfo?: { owner: string; name: string };
}

export const ErrorLogModal: React.FC<ErrorLogModalProps> = ({
  isOpen,
  onClose,
  issues,
  repoInfo,
}) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const errorsCount = issues.filter((i) => i.severity === 'error').length;
  const warningsCount = issues.filter((i) => i.severity === 'warning').length;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ErrorLog Export 機能 (JSONファイルのダウンロード)
  const handleExportErrorLog = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `copilot_error_log_${timestamp}.json`;

    const exportPayload = {
      exported_at: new Date().toISOString(),
      repository: repoInfo || 'unknown',
      total_issues: issues.length,
      errors_count: errorsCount,
      warnings_count: warningsCount,
      issues: issues.map((issue) => ({
        id: issue.id,
        timestamp: issue.timestamp,
        severity: issue.severity,
        category: issue.category,
        target: issue.target,
        http_status: issue.http_status,
        message: issue.message,
        details: issue.details,
        affected_fields: issue.affected_fields,
      })),
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* 画面幅80%、画面高さ80% のモーダルコンテナ */}
      <div
        className="w-[80vw] h-[80vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl ${
                errorsCount > 0
                  ? 'bg-rose-950/80 text-rose-400 border border-rose-800/70'
                  : 'bg-amber-950/80 text-amber-400 border border-amber-800/70'
              }`}
            >
              {errorsCount > 0 ? (
                <AlertCircle className="w-6 h-6 animate-pulse" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  GitHub データ取得 異常検出ログ
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  全 {issues.length} 件
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                API連携時に検知されたエラーおよび警告一覧。該当データは「データ不明」として安全に除外されています。
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* 件数バッジ */}
            <div className="hidden sm:flex items-center space-x-2 text-xs">
              {errorsCount > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800 font-semibold flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Error: {errorsCount}件</span>
                </span>
              )}
              {warningsCount > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800 font-semibold flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Warning: {warningsCount}件</span>
                </span>
              )}
            </div>

            {/* Exportボタン */}
            <button
              onClick={handleExportErrorLog}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md shadow-indigo-600/30"
              title="ErrorLogをJSONファイルとしてダウンロード"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Log</span>
            </button>

            {/* 閉じるボタン */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* モーダルボディ (スクロールエリア: 概ね3件が表示されるゆったりとしたカードサイズ) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-900/60">
          {issues.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Info className="w-8 h-8 text-slate-600" />
              <p className="text-sm">現在、検知された異常・エラーはありません。全データが正常に同期されています。</p>
            </div>
          ) : (
            issues.map((issue) => {
              const isExpanded = !!expandedIds[issue.id];
              const isError = issue.severity === 'error';

              return (
                <div
                  key={issue.id}
                  className={`border rounded-xl p-5 transition-all ${
                    isError
                      ? 'bg-rose-950/20 border-rose-900/60 hover:border-rose-700/80'
                      : 'bg-amber-950/20 border-amber-900/60 hover:border-amber-700/80'
                  }`}
                >
                  {/* カードヘッダー */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md border ${
                          isError
                            ? 'bg-rose-900/80 text-rose-200 border-rose-700'
                            : 'bg-amber-900/80 text-amber-200 border-amber-700'
                        }`}
                      >
                        {issue.severity}
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {issue.target}
                      </span>
                      {issue.http_status && (
                        <span className="text-[11px] font-mono text-slate-400">
                          HTTP {issue.http_status}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(issue.timestamp).toLocaleString('ja-JP')}</span>
                    </div>
                  </div>

                  {/* メッセージ本文 (最大3行表示、以降は省略) */}
                  <div className="mt-3">
                    <p
                      className={`text-xs text-slate-200 leading-relaxed font-sans ${
                        isExpanded ? '' : 'line-clamp-3'
                      }`}
                    >
                      {issue.message}
                    </p>
                  </div>

                  {/* 展開された詳細情報 (スタックトレースや詳細レスポンス) */}
                  {isExpanded && issue.details && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        詳細トレース / API レスポンス:
                      </span>
                      <pre className="text-[11px] font-mono bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                        {issue.details}
                      </pre>
                    </div>
                  )}

                  {/* 影響を受ける項目 */}
                  {issue.affected_fields && issue.affected_fields.length > 0 && (
                    <div className="mt-2.5 flex items-center space-x-2 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-400">影響スコープ:</span>
                      {issue.affected_fields.map((field) => (
                        <span
                          key={field}
                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 展開・折りたたみボタン (1件あたり最大3行表示のトグル) */}
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      onClick={() => toggleExpand(issue.id)}
                      className={`text-xs font-semibold flex items-center space-x-1 transition-colors ${
                        isError
                          ? 'text-rose-400 hover:text-rose-300'
                          : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <span>{isExpanded ? '折りたたむ' : '詳細を展開して表示'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center space-x-2">
            <span>異常ログはリポジトリの独立ブランチに保存され、ダッシュボードから安全にエクスポートできます。</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
