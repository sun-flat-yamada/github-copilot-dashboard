import React, { useState, useRef, useEffect } from 'react';
import {
  DataSourceType,
  AnalysisScopeType,
  IndexMetadata,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  FilterCriteria,
  DEFAULT_FILTER_CRITERIA,
} from '../../../../src/types/copilot';
import { ActiveDataSelector } from './ActiveDataSelector';
import { useCurrency } from '../../contexts/CurrencyContext';
import { RepoInfo } from '../../hooks/useDashboardData';
import {
  Sparkles,
  Info,
  Star,
  AlertCircle,
  AlertTriangle,
  Sun,
  Moon,
  MoreVertical,
  Coins,
  Check,
} from 'lucide-react';
import { Theme } from '../../hooks/useTheme';

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
  // 統合フィルター条件 (2階層特定モデル & SDD-15)
  filterCriteria?: FilterCriteria;
  onApplyFilterCriteria?: (criteria: FilterCriteria) => void;
  onResetFilterCriteria?: () => void;
  availableCostCenters?: string[];
  availableOrganizations?: string[];
  availableGroups?: string[];
  availableTags?: string[];
  currentScopeData?: ScopeAggregatedData | null;
  currentReportData?: MonthlyReportAggregatedData | null;
  repoInfo: RepoInfo;
  isStarred: boolean;
  onToggleStar: () => void;
  allIssuesCount: number;
  hasErrors: boolean;
  onOpenErrorModal: () => void;
  onOpenAboutModal: () => void;
  /**
   * グローバルな既定ディレクトリ選好 (DEMO/LIVE のどちらを優先的に読み込むか)。
   * バッジの表示切替には activeDataIsDemoSourced を使用するため、このコンポーネント内では
   * 表示目的では参照しない (onToggleDemoMode 経由の手動切替のみに使用される呼び出し元の状態)。
   */
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
  /**
   * 現在アクティブに選択されているデータソース (Live Metrics / Monthly Report / User Upload) が
   * 実際に DEMO データを表示しているかどうか。isDemoMode (グローバルな既定ディレクトリ選好) とは
   * 独立しており、他ソースが DEMO フォールバックしていてもアクティブソースが実データであれば
   * false になる。未取得時は undefined (静的ヒューリスティックにフォールバック)。
   */
  activeDataIsDemoSourced?: boolean;
  theme?: Theme;
  onToggleTheme?: () => void;
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
  filterCriteria = DEFAULT_FILTER_CRITERIA,
  onApplyFilterCriteria = () => {},
  onResetFilterCriteria = () => {},
  availableCostCenters = [],
  availableOrganizations = [],
  availableGroups = [],
  availableTags = [],
  currentScopeData = null,
  currentReportData = null,
  repoInfo,
  isStarred,
  onToggleStar,
  allIssuesCount,
  hasErrors,
  onOpenErrorModal,
  onOpenAboutModal,
  onToggleDemoMode,
  activeDataIsDemoSourced,
  theme = 'dark',
  onToggleTheme,
}) => {
  const isMockMode = isMockModeData(indexMeta, repoInfo);
  // バッジは「アクティブに選択中のデータソースが実際にDEMOかどうか」を最優先で反映する。
  // 未取得 (undefined) の場合のみ、静的ヒューリスティック (isMockMode) にフォールバックする。
  const showDemoBadge = activeDataIsDemoSourced !== undefined ? activeDataIsDemoSourced : isMockMode;

  // 通貨および表示設定メニュー状態 (スリードットメニュー用)
  const { subCurrencyCode, setSubCurrencyCode, availableSubCurrencies } = useCurrency();
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // 外側クリックおよびEscキー押下でスリードットメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsMenuOpen(false);
      }
    };

    if (isSettingsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsMenuOpen]);

  const activeCurrency =
    availableSubCurrencies.find((c) => c.code === subCurrencyCode) || availableSubCurrencies[0];

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
        {/* ブランド & タイトル & Aboutボタン */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          <div
            className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 flex-shrink-0"
            title="GitHub Copilot Analytics"
          >
            <Sparkles className="w-5 h-5" />
          </div>

          {/* タイトル & 動作モードバッジ & サブタイトル (十分な表示幅がある場合: xl以上で表示、幅不足時はアイコン表示のみ) */}
          <div className="hidden xl:flex flex-col justify-center">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight whitespace-nowrap">
                GitHub Copilot Analytics
              </h1>
              {/* 動作モードインジケーター (Mock / DEMO vs LIVE) */}
              {showDemoBadge ? (
                <span
                  data-testid="mock-mode-badge"
                  data-demo-mode={showDemoBadge}
                  onClick={onToggleDemoMode}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-sm whitespace-nowrap select-none ${
                    onToggleDemoMode ? 'cursor-pointer hover:bg-amber-500/25 transition-colors' : 'cursor-help'
                  }`}
                  title="【DEMO / Mock モード】現在アクティブに選択中のデータ (Live Metrics / Monthly Report / User Upload) はシミュレーション用の架空（デモ用）データです。クリックで既定のLIVEデータ/DEMOデータを切り替え可能です。"
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
                  data-demo-mode={showDemoBadge}
                  onClick={onToggleDemoMode}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 whitespace-nowrap select-none ${
                    onToggleDemoMode ? 'cursor-pointer hover:bg-emerald-500/20 transition-colors' : 'cursor-help'
                  }`}
                  title="【LIVE 実データモード】現在アクティブに選択中のデータ (GitHub API / 月次利用レポート / アップロードファイル) は実績データです。クリックで既定のDEMOデータを表示可能です。"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>LIVE</span>
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 whitespace-nowrap">
              Copilot Insights for All Users
            </p>
          </div>

          {/* Information アイコン (幅不足時でも Sparkles アイコンの隣に常時残り、他要素と被らない) */}
          <button
            onClick={onOpenAboutModal}
            className="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors flex items-center cursor-pointer flex-shrink-0"
            title="システム情報・分析作成日時 (About)"
            aria-label="About"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 右側アクション (アクティブデータ選択、リポジトリリンク、エラー通知) */}
        <div className="flex items-center space-x-2 sm:space-x-3 text-xs min-w-0 flex-shrink justify-end">
          {/* アクティブデータセレクター (要件1: 自動定期収集 / 月次レポート / オンデマンドCSV ＋ 要件2: ANDフィルター) */}
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
            filterCriteria={filterCriteria}
            onApplyFilterCriteria={onApplyFilterCriteria}
            onResetFilterCriteria={onResetFilterCriteria}
            availableCostCenters={availableCostCenters}
            availableOrganizations={availableOrganizations}
            availableGroups={availableGroups}
            availableTags={availableTags}
            currentScopeData={currentScopeData}
            currentReportData={currentReportData}
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

          {/* 表示設定メニュー (スリードットメニュー: 表示モード切替 ＆ 通貨表示切替を集約) */}
          <div className="relative inline-block text-left flex-shrink-0" ref={settingsMenuRef}>
            <button
              type="button"
              onClick={() => setIsSettingsMenuOpen((prev) => !prev)}
              data-testid="header-settings-menu-button"
              aria-expanded={isSettingsMenuOpen}
              aria-haspopup="menu"
              className={`flex items-center justify-center p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${
                isSettingsMenuOpen
                  ? 'bg-slate-800 border-indigo-500/50 text-indigo-300 ring-2 ring-indigo-500/20'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
              title="表示設定（通貨・表示モード）"
              aria-label="表示設定メニュー"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isSettingsMenuOpen && (
              <div
                role="menu"
                aria-orientation="vertical"
                aria-labelledby="header-settings-menu-button"
                className="absolute right-0 mt-2 w-64 sm:w-72 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl p-2.5 z-50 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
              >
                {/* メニューヘッダー */}
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 mb-2">
                  表示設定 (Display Settings)
                </div>

                {/* セクション 1: 表示モード切替 (Theme) */}
                <div className="px-1 mb-2">
                  <div className="text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5">
                      {theme === 'dark' ? (
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      ) : (
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <span>表示モード</span>
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {theme === 'dark' ? 'Dark' : 'Light'}
                    </span>
                  </div>
                  {onToggleTheme && (
                    <button
                      type="button"
                      onClick={onToggleTheme}
                      data-testid="theme-toggle-button"
                      aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
                      title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-200 transition cursor-pointer text-xs group"
                    >
                      <span className="flex items-center space-x-2">
                        {theme === 'dark' ? (
                          <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
                        ) : (
                          <Moon className="w-4 h-4 text-indigo-400 group-hover:-rotate-12 transition-transform" />
                        )}
                        <span className="font-medium">
                          {theme === 'dark' ? 'ライトモードに変更' : 'ダークモードに変更'}
                        </span>
                      </span>
                      <span className="text-[10px] text-indigo-400 group-hover:text-indigo-300 font-medium">
                        切替
                      </span>
                    </button>
                  )}
                </div>

                <div className="border-t border-slate-800/80 my-2" />

                {/* セクション 2: 通貨表示切替 (Currency) */}
                <div className="px-1">
                  <div className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>サブ表示通貨</span>
                    </span>
                    <span className="font-mono text-emerald-400 font-bold text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
                      {activeCurrency.code === 'none' ? 'USD' : `USD+${activeCurrency.code}`}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mb-1.5 px-0.5">
                    USD常時基本表示＋任意サブ通貨
                  </div>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto pr-0.5">
                    {availableSubCurrencies.map((item) => {
                      const isSelected = item.code === subCurrencyCode;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => {
                            setSubCurrencyCode(item.code);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-indigo-950/70 text-indigo-200 font-semibold border border-indigo-800/50'
                              : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                          }`}
                        >
                          <span>{item.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
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
