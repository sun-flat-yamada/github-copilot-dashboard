import React from 'react';
import { CreditsPresenter } from '../../../../src/adapters/presenters/CreditsPresenter';
import { CreditsView } from '../../components/views/CreditsView';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { currentData, currentReportData } = ctx;
  return (
    <div className="w-full">
      <CreditsView viewModel={CreditsPresenter.present({ currentData, currentReportData })} />
    </div>
  );
};

export default View;
