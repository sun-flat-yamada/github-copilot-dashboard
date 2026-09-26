import React, { useState, useRef, useEffect } from 'react';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Coins, ChevronDown, Check } from 'lucide-react';

export const CurrencySelector: React.FC = () => {
  const { subCurrencyCode, setSubCurrencyCode, availableSubCurrencies } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeItem = availableSubCurrencies.find((c) => c.code === subCurrencyCode) || availableSubCurrencies[0];

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition shadow-sm text-xs font-semibold cursor-pointer"
        title="サブ表示通貨の切り替え (USDは常時基本表示されます)"
        aria-label="通貨切替セレクター"
      >
        <Coins className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline">通貨:</span>
        <span className="font-mono text-emerald-400 font-bold">
          {activeItem.code === 'none' ? 'USD' : `USD+${activeItem.code}`}
        </span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400">
            サブ表示通貨 (USDは常時表示)
          </div>
          {availableSubCurrencies.map((item) => {
            const isSelected = item.code === subCurrencyCode;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setSubCurrencyCode(item.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition cursor-pointer text-left ${
                  isSelected
                    ? 'bg-indigo-950/60 text-indigo-300 font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span>{item.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
