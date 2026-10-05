import React from 'react';
import { ModelRadarView } from '../../components/ModelRadarView';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { currentData, currentReportData, isReportSource, focusedRadarModelId, onOpenTrendForModel } = ctx;
  // useDashboardData は選択ソースに関係なく Live スコープ (currentData) を常に返すため、
  // アクティブなソースのデータだけを渡す (両方渡すと computeModelUsage が Live を優先し、
  // 月次レポート / アップロード選択時の Top3 とシェア(%)が選択中のデータ群と食い違う)
  const aggregatedData = isReportSource ? null : currentData;
  const monthlyReportData = isReportSource ? currentReportData : null;
  return (
    <div className="w-full">
      <ModelRadarView
        initialSelectedModelId={focusedRadarModelId}
        aggregatedData={aggregatedData}
        monthlyReportData={monthlyReportData}
        onNavigateToTrend={onOpenTrendForModel}
      />
    </div>
  );
};

export default View;
