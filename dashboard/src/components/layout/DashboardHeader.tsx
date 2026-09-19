import React from 'react';
import {
  DataSourceType,
  AnalysisScopeType,
  IndexMetadata,
  MonthlyReportAggregatedData,
} from '../../../../src/types/copilot';
import { ActiveDataSelector } from './ActiveDataSelector';
import { RepoInfo } from '../../hooks/useDashboardData';
import {
  Sparkles,
  Info,
  Star,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';

interface DashboardHeaderProps {
  activeSource: DataSourceType;
  onSelectSource: (source: DataSourceType) => void;
  indexMeta: IndexMetadata | null;
  scopeType: AnalysisScopeType;
  selectedScopeKey: string;
  onSelectLiveScope: (type: AnalysisScopeType, key: string) => void;
  availableReports: string[];
  selectedReportMonth: string;
  onSelectReportMonth: (month: string) => void;
  uploadedData: MonthlyReportAggregatedData | null;
  onUploadFileLoaded: (data: MonthlyReportAggregatedData) => void;
  onClearUploadedFile: () => void;
  repoInfo: RepoInfo;
  isStarred: boolean;
  onToggleStar: () => void;
  allIssuesCount: number;
  hasErrors: boolean;
  onOpenErrorModal: () => void;
  onOpenAboutModal: () => void;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
}

/**
 * データが DEMO (モック・シミュレーション) 用か LIVE (実データ) かを判定する。
 * 1. 明示的な is_mock_mode フラグを最優先。
 * 2. 環境変数 VITE_MOCK_MODE === 'true' を考慮。
 * 3. is_mock_mode が未指定 (古いデータやキャッシュ) の場合：
 *    - repository.owner が 'proud-corp' (2026仕様シミュレーションモックの組織名)
 *    - repoInfo.owner が 'proud-corp'
 *    - issues に 'proud-' 関連のモック検証イシューが含まれる
 *    これらを検知して確実に DEMO (Mock) として扱う。
 */
export function isMockModeData(
  indexMeta: IndexMetadata | null,
  repoInfo?: { owner: string; name: string }
): boolean {
  // 1. 明示的な is_mock_mode: true
  if (indexMeta?.is_mock_mode === true) {
    return true;
  }

  // 2. 環境変数の設定
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOCK_MODE === 'true') {
    return true;
  }

  // 3. proud-corp はシミュレーションモック組織名
  if (indexMeta?.repository?.owner === 'proud-corp' || repoInfo?.owner === 'proud-corp') {
    return true;
  }

  // 4. 実稼働メトリクス (管理シート数 > 0 または 日次データ日数 > 0) の有無を検証
  //    実エンタープライズの認証情報が存在せず、ライブメトリクスが0件の場合は実稼働 (LIVE) ではなく
  //    デモ用・空シミュレーション状態であるため確実に DEMO (Mock) として扱う
  const totalSeats = indexMeta?.summary?.total_seats ?? 0;
  const availableDaysCount = indexMeta?.available_days?.length ?? 0;
  const hasRealLiveMetrics = totalSeats > 0 || availableDaysCount > 0;

  if (!hasRealLiveMetrics) {
    return true;
  }

  // 5. モック専用イシューのシグネチャ
  if (indexMeta?.issues?.some((i) => i.target?.includes('proud-') || i.details?.includes('proud-corp'))) {
    return true;
  }

  // 6. 明示的な is_mock_mode: false かつ 実際にライブデータが存在する場合のみ LIVE
  if (indexMeta?.is_mock_mode === false && hasRealLiveMetrics) {
    return false;
  }

  return !hasRealLiveMetrics;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeSource,
  onSelectSource,
  indexMeta,
  scopeType,
  selectedScopeKey,
  onSelectLiveScope,
  availableReports,
  selectedReportMonth,
  onSelectReportMonth,
  uploadedData,
  onUploadFileLoaded,
  onClearUploadedFile,
  repoInfo,
  isStarred,
  onToggleStar,
  allIssuesCount,
  hasErrors,
  onOpenErrorModal,
  onOpenAboutModal,
  isDemoMode,
  onToggleDemoMode,
}) => {
  const isMockMode = isMockModeData(indexMeta, repoInfo);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* ブランド & タイトル & Aboutボタン */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 flex-shrink-0 min-w-max">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex flex-col justify-center">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight whitespace-nowrap">
                GitHub Copilot Analytics
              </h1>
              {/* 動作モードインジケーター (Mock / DEMO vs LIVE) */}
              {isMockMode ? (
                <span
                  data-testid="mock-mode-badge"
                  data-demo-mode={isDemoMode}
                  onClick={onToggleDemoMode}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-sm whitespace-nowrap select-none ${
                    onToggleDemoMode ? 'cursor-pointer hover:bg-amber-500/25 transition-colors' : 'cursor-help'
                  }`}
                  title="【DEMO / Mock モード】このダッシュボードに表示されているデータはすべてシミュレーション用の架空（デモ用）データです。クリックでLIVEデータ/DEMOデータを切り替え可能です。"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                  </span>
                  <span>DEMO (Mock)</span>
                </span>
              ) : (
                <span
                  data-testid="live-mode-badge"
                  data-demo-mode={isDemoMode}
                  onClick={onToggleDemoMode}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 whitespace-nowrap select-none ${
                    onToggleDemoMode ? 'cursor-pointer hover:bg-emerald-500/20 transition-colors' : 'cursor-help'
                  }`}
                  title="【LIVE 実データモード】GitHub API / 月次利用レポートの実績データを表示しています。クリックでDEMOデータを表示可能です。"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>LIVE</span>
                </span>
              )}
              <button
                onClick={onOpenAboutModal}
                className="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors flex items-center cursor-pointer flex-shrink-0"
                title="システム情報・分析作成日時 (About)"
                aria-label="About"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 hidden md:block whitespace-nowrap">
              3-Axis Allocation (Org, Cost Center, User Mapping)
            </p>
          </div>
        </div>

        {/* 右側アクション (アクティブデータ選択、リポジトリリンク、エラー通知) */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs min-w-0 flex-shrink justify-end">
          {/* アクティブデータセレクター (要件1: Live Metrics / Monthly Report / User Upload) */}
          <ActiveDataSelector
            activeSource={activeSource}
            onSelectSource={onSelectSource}
            indexMeta={indexMeta}
            scopeType={scopeType}
            selectedScopeKey={selectedScopeKey}
            onSelectLiveScope={onSelectLiveScope}
            availableReports={availableReports}
            selectedReportMonth={selectedReportMonth}
            onSelectReportMonth={onSelectReportMonth}
            uploadedData={uploadedData}
            onUploadFileLoaded={onUploadFileLoaded}
            onClearUploadedFile={onClearUploadedFile}
          />

          {/* 生成元 GitHub リポジトリリンク & Star (Forkセーフ・動的解決) */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex-shrink-0">
            <a
              href={repoInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 p-2 rounded-l-xl transition-all group cursor-pointer"
              title={`GitHubリポジトリを開く: ${repoInfo.owner}/${repoInfo.name}\nURL: ${repoInfo.url}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <div className="w-px h-4 bg-slate-700" />
            <button
              onClick={onToggleStar}
              className={`flex items-center justify-center p-2 rounded-r-xl transition-all group cursor-pointer ${
                isStarred
                  ? 'text-amber-400 bg-slate-800'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
              }`}
              title={isStarred ? 'Star on GitHub (Star済み)' : 'Star on GitHub'}
              aria-label="Star on GitHub"
            >
              <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-400' : 'transition-colors'}`} />
            </button>
          </div>

          {/* 異常検出 (Error / Warning) アイコンボタン */}
          {allIssuesCount > 0 && (
            <button
              onClick={onOpenErrorModal}
              className={`relative p-2 rounded-xl border transition-all flex items-center space-x-1.5 cursor-pointer shadow-md flex-shrink-0 ${
                hasErrors
                  ? 'bg-rose-950/70 border-rose-800 text-rose-400 hover:bg-rose-900/80 hover:border-rose-600 animate-pulse'
                  : 'bg-amber-950/70 border-amber-800 text-amber-400 hover:bg-amber-900/80 hover:border-amber-600'
              }`}
              title="データ取得時の異常・エラー一覧を表示"
            >
              {hasErrors ? (
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
              <span className="hidden md:inline-block text-xs font-bold">
                {hasErrors ? 'エラー検知' : '警告あり'}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  hasErrors ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'
                }`}
              >
                {allIssuesCount}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
