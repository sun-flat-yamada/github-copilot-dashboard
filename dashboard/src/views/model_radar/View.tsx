import React from 'react';
import { ModelRadarView } from '../../components/ModelRadarView';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { currentData, currentReportData, focusedRadarModelId, onOpenTrendForModel } = ctx;
  return (
    <div className="w-full">
      <ModelRadarView
        initialSelectedModelId={focusedRadarModelId}
        aggregatedData={currentData}
        monthlyReportData={currentReportData}
        onNavigateToTrend={onOpenTrendForModel}
      />
    </div>
  );
};

export default View;
