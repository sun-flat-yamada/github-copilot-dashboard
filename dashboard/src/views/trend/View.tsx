import React from 'react';
import { UserTrendViewer } from '../../components/UserTrendViewer';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const {
    currentData, deepAnalysisProfiles, deepAnalysisSourceInfo, focusedUserLogin,
    onOpenRadar: handleOpenRadar, onOpenDeepAnalysis: handleOpenDeepAnalysis,
  } = ctx;
  return (
    <div className="flex flex-col space-y-6 w-full">
      <UserTrendViewer
        profiles={deepAnalysisProfiles.length > 0 ? deepAnalysisProfiles : (currentData?.user_profiles || [])}
        initialSelectedLogin={focusedUserLogin}
        sourceInfo={deepAnalysisSourceInfo}
        onOpenRadar={handleOpenRadar}
        onOpenDeepAnalysis={handleOpenDeepAnalysis}
      />
    </div>
  );
};

export default View;
