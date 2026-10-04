import React from 'react';
import { AuditDataQualitySection } from '../../components/AuditDataQualityPanel';
import { AuditMonthCloseSection } from '../../components/AuditMonthClosePanel';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => (
  <div className="flex w-full flex-col space-y-6">
    <AuditDataQualitySection baseDir={ctx.dataBaseDir} isDemo={ctx.isDemoData} />
    <AuditMonthCloseSection baseDir={ctx.dataBaseDir} />
  </div>
);

export default View;
