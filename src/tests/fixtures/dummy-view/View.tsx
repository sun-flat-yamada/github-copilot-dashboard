import React from 'react';
import type { ViewContext } from '../../../../dashboard/src/views/types.js';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => (
  <div data-testid="dummy-view">dummy:{ctx.activeSource}</div>
);
