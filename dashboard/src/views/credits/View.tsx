import React from 'react';
import { CreditsPresenter } from '../../../../src/adapters/presenters/CreditsPresenter';
import { CreditsView } from '../../components/views/CreditsView';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { currentData, currentReportData, dataBaseDir, isDemoData } = ctx;
  return (
    <div className="w-full">
      <CreditsView
        viewModel={CreditsPresenter.present({ currentData, currentReportData })}
        currentReportData={currentReportData}
        baseDir={dataBaseDir}
        isDemo={isDemoData}
      />
    </div>
  );
};

export default View;
