import React from 'react';
import { AlertCircle, AlertTriangle, FlaskConical } from 'lucide-react';
import { DataStatusItem, DataStatusLevel } from '../../utils/dataStatus';

interface DataStatusBannerProps {
  items: DataStatusItem[];
  /**
   * DEMO 表示を明示的に選択しているときだけ渡す。実データ表示へ戻すための操作。
   * (データ自身が is_mock_mode を宣言している場合は戻す先がないため渡さない)
   */
  onSwitchToLive?: () => void;
}

const LEVEL_STYLES: Record<DataStatusLevel, { container: string; icon: string; label: string }> = {
  demo: {
    container: 'bg-amber-950/50 border-amber-700/70 text-amber-100',
    icon: 'text-amber-400',
    label: 'デモ',
  },
  error: {
    container: 'bg-red-950/50 border-red-800/80 text-red-100',
    icon: 'text-red-400',
    label: 'エラー',
  },
  warning: {
    container: 'bg-yellow-950/40 border-yellow-800/70 text-yellow-100',
    icon: 'text-yellow-400',
    label: '警告',
  },
};

function LevelIcon({ level, className }: { level: DataStatusLevel; className: string }) {
  if (level === 'error') return <AlertCircle className={className} aria-hidden="true" />;
  if (level === 'warning') return <AlertTriangle className={className} aria-hidden="true" />;
  return <FlaskConical className={className} aria-hidden="true" />;
}

/**
 * 画面最上部のデータ状態バナー。
 * 色だけでなくアイコンとラベル文言で種別を示す (色覚に依存しない)。
 * - demo: 架空データを実データと誤認させない
 * - error / warning: ソース取得の失敗・一部失敗を「0 件」「空」に見せない
 */
export const DataStatusBanner: React.FC<DataStatusBannerProps> = ({ items, onSwitchToLive }) => {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col space-y-2" data-testid="data-status-banner">
      {items.map((item) => {
        const style = LEVEL_STYLES[item.level];
        return (
          <div
            key={item.id}
            role={item.level === 'error' ? 'alert' : 'status'}
            data-testid={`data-status-${item.id}`}
            className={`rounded-xl border px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow ${style.container}`}
          >
            <div className="flex items-start space-x-2.5">
              <LevelIcon level={item.level} className={`w-4 h-4 mt-0.5 shrink-0 ${style.icon}`} />
              <div>
                <p className="font-semibold">
                  <span className="mr-1.5 text-[10px] uppercase tracking-wide opacity-80">[{style.label}]</span>
                  {item.title}
                </p>
                {item.detail && <p className="mt-0.5 opacity-90 leading-relaxed">{item.detail}</p>}
              </div>
            </div>
            {item.level === 'demo' && onSwitchToLive && (
              <button
                type="button"
                onClick={onSwitchToLive}
                data-testid="data-status-switch-to-live"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-900/70 hover:bg-amber-800 text-amber-100 border border-amber-700/60 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
              >
                実データを表示
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
