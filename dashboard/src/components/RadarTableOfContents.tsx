import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Compass,
  BrainCircuit,
  FileCode2,
  Layers,
  BookOpen,
  ListTree,
  PanelRightClose,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export interface RadarCategorySection {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const RADAR_SECTIONS: RadarCategorySection[] = [
  {
    id: 'radar-overview',
    number: '01',
    title: '概要・モデル選択 & プリセット',
    shortTitle: 'モデル選択 & プリセット',
    description: '比較プリセット、モデル選択チップス、メーカー/Tier別分類',
    icon: Sliders,
  },
  {
    id: 'radar-chart',
    number: '02',
    title: '6軸多次元特性マップ',
    shortTitle: '6軸レーダーマップ',
    description: '総合・SWE・AIME・コンテキスト・速度・コストの6軸チャート',
    icon: Compass,
  },
  {
    id: 'radar-detail',
    number: '03',
    title: 'フォーカスモデル詳細・実務判定',
    shortTitle: 'モデル詳細・実務判定',
    description: '推論単価・Context窓、推奨用途・注意点、エンジニア界隈の声',
    icon: BrainCircuit,
  },
  {
    id: 'radar-table',
    number: '04',
    title: '著名ベンチマーク実測比較テーブル',
    shortTitle: '実測比較テーブル',
    description: 'SWE-bench, AIME, Arena Elo, 速度, コストの実測値一覧',
    icon: FileCode2,
  },
  {
    id: 'radar-sources',
    number: '05',
    title: '出典の設計背景・現場の見え方',
    shortTitle: '出典背景・現場の見え方',
    description: '各ベンチマークの出題意図、現場での見え方、SNSの噂・議論',
    icon: Layers,
  },
  {
    id: 'radar-references',
    number: '06',
    title: 'GitHub Copilot 公式仕様リファレンス',
    shortTitle: '公式仕様リファレンス',
    description: '公式サポートモデル一覧、公式課金・単価表への直接リンク',
    icon: BookOpen,
  },
];

const STORAGE_KEY = 'copilot_radar_toc_visible';

export const RadarTableOfContents: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const [activeId, setActiveId] = useState<string>('radar-overview');

  // 開閉状態の永続化
  const toggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage が利用不可でも動作継続
      }
      return next;
    });
  };

  // スクロール位置に応じたアクティブカテゴリの検出 (ScrollSpy)
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 160; // ヘッダーおよび上部マージン考慮
      for (let i = RADAR_SECTIONS.length - 1; i >= 0; i--) {
        const section = RADAR_SECTIONS[i];
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY;
          if (scrollPosition >= top) {
            setActiveId(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 該当カテゴリへのスムーズジャンプ
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  // 最上部へ戻る
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 最下部へ移動
  const scrollToBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  // 折りたたみ時: 画面右端のコンパクトなトグルボタン
  if (!isOpen) {
    return (
      <div className="fixed right-2 sm:right-3 top-28 z-40">
        <button
          onClick={toggleOpen}
          className="flex items-center space-x-2 px-3 py-2 bg-slate-900/95 hover:bg-slate-800 text-indigo-300 hover:text-white border border-indigo-500/50 rounded-l-xl shadow-2xl backdrop-blur-md transition-all group hover:border-indigo-400"
          title="目次・カテゴリ一覧を表示"
          aria-label="目次・カテゴリ一覧を表示"
        >
          <ListTree className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold tracking-wide">カテゴリ一覧</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>
    );
  }

  // 展開時: 画面右側のフローティング目次パネル
  return (
    <div className="fixed right-2 sm:right-4 top-24 z-40 w-72 sm:w-80 max-h-[calc(100vh-7.5rem)] bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
      {/* パネルヘッダー */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <ListTree className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-white tracking-wide">ページ内カテゴリ目次</span>
          <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700">
            {RADAR_SECTIONS.length}
          </span>
        </div>
        <button
          onClick={toggleOpen}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="目次を折りたたむ (非表示)"
          aria-label="目次を折りたたむ"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {/* カテゴリ一覧リスト */}
      <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-13.5rem)] scrollbar-thin scrollbar-thumb-slate-700">
        {RADAR_SECTIONS.map((sec) => {
          const isActive = activeId === sec.id;
          const IconComponent = sec.icon;
          return (
            <button
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              className={`w-full text-left px-2.5 py-2 rounded-xl transition-all flex items-start space-x-2.5 ${
                isActive
                  ? 'bg-indigo-600/20 border border-indigo-500/50 text-white shadow-sm'
                  : 'hover:bg-slate-800/60 border border-transparent text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-1.5 mt-0.5 flex-shrink-0">
                <span
                  className={`text-[10px] font-mono font-bold px-1 rounded ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {sec.number}
                </span>
                <IconComponent
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    isActive ? 'text-indigo-400' : 'text-slate-400'
                  }`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold truncate ${
                      isActive ? 'text-indigo-200' : 'text-slate-200'
                    }`}
                  >
                    {sec.title}
                  </span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 animate-ping ml-1" />
                  )}
                </div>
                <p className="text-[10px] text-slate-400 truncate mt-0.5 leading-tight">
                  {sec.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* パネルフッター: クイック移動アクション */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/70 border-t border-slate-800/80 text-[11px] text-slate-400">
        <button
          onClick={scrollToTop}
          className="flex items-center space-x-1 hover:text-indigo-300 transition-colors px-2 py-1 rounded hover:bg-slate-800"
          title="ページの先頭へ戻る"
        >
          <ArrowUp className="w-3 h-3" />
          <span>トップへ</span>
        </button>
        <button
          onClick={scrollToBottom}
          className="flex items-center space-x-1 hover:text-indigo-300 transition-colors px-2 py-1 rounded hover:bg-slate-800"
          title="ページの最下部へ移動"
        >
          <ArrowDown className="w-3 h-3" />
          <span>最下部へ</span>
        </button>
      </div>
    </div>
  );
};

export default RadarTableOfContents;
