import React from 'react';
import { AgentPresenter } from '../../../../src/adapters/presenters/AgentPresenter';
import { AgentActivityView } from '../../components/views/AgentActivityView';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { currentData } = ctx;
  return (
    <div className="w-full">
      <AgentActivityView viewModel={AgentPresenter.present({ currentData })} />
    </div>
  );
};

export default View;
