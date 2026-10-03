import React from 'react';
import { DeepAnalysisView } from '../../components/DeepAnalysisView';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { currentData, deepAnalysisProfiles, deepAnalysisSourceInfo, focusedUserLogin, setFocusedUserLogin } = ctx;
  return (
    <div className="flex flex-col space-y-6 w-full">
      <DeepAnalysisView
        aggregatedData={currentData}
        userProfiles={deepAnalysisProfiles}
        sourceInfo={deepAnalysisSourceInfo}
        initialSelectedLogin={focusedUserLogin}
        onSelectLogin={setFocusedUserLogin}
      />
    </div>
  );
};

export default View;
