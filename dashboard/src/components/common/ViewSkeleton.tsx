import React from 'react';

export const ViewSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col space-y-6 w-full animate-pulse" role="status" aria-label="Loading view">
      {/* KPI Cards Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 h-28 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-slate-800 rounded w-24"></div>
              <div className="h-5 w-5 bg-slate-800 rounded-full"></div>
            </div>
            <div className="h-8 bg-slate-800 rounded w-36"></div>
          </div>
        ))}
      </div>

      {/* Main Content / Chart Placeholder */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 h-80 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-slate-800 rounded w-48"></div>
          <div className="h-4 bg-slate-800 rounded w-20"></div>
        </div>
        <div className="flex-1 bg-slate-800/40 rounded-lg flex items-center justify-center">
          <span className="text-xs text-slate-500 font-mono tracking-wider">LOADING VIEW COMPONENTS...</span>
        </div>
      </div>

      {/* Secondary Table / Grid Placeholder */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 h-64 flex flex-col space-y-3">
        <div className="h-5 bg-slate-800 rounded w-40"></div>
        <div className="space-y-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-slate-800/40 rounded w-full"></div>
          ))}
        </div>
      </div>
    </div>
  );
};
