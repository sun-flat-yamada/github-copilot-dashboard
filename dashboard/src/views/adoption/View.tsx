import React from 'react';
import { AdoptionPresenter } from '../../../../src/adapters/presenters/AdoptionPresenter';
import { AdoptionMaturityView } from '../../components/views/AdoptionMaturityView';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const { currentData } = ctx;
  return (
    <div className="w-full">
      <AdoptionMaturityView viewModel={AdoptionPresenter.present({ currentData })} />
    </div>
  );
};

export default View;
