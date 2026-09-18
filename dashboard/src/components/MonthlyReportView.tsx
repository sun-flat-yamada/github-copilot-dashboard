import React from 'react';
import { MonthlyReportAggregatedData } from '../../../src/types/copilot';
import { MonthlyReportToolbar } from './monthly-report/MonthlyReportToolbar';
import { MonthlyReportKpis } from './monthly-report/MonthlyReportKpis';
import { MonthlyReportCharts } from './monthly-report/MonthlyReportCharts';
import { MonthlyReportUserTable } from './monthly-report/MonthlyReportUserTable';

interface MonthlyReportViewProps {
  reportData: MonthlyReportAggregatedData;
  availableReportMonths: string[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onOpenDropzone: () => void;
}

export const MonthlyReportView: React.FC<MonthlyReportViewProps> = ({
  reportData,
  availableReportMonths,
  selectedMonth,
  onSelectMonth,
  onOpenDropzone,
}) => {
  return (
    <div className="flex flex-col space-y-6">
      {/* 1. レポートツールバー (月切り替え & CSVドロップゾーン) */}
      <MonthlyReportToolbar
        reportData={reportData}
        availableReportMonths={availableReportMonths}
        selectedMonth={selectedMonth}
        onSelectMonth={onSelectMonth}
        onOpenDropzone={onOpenDropzone}
      />

      {/* 2. KPI サマリーカード */}
      <MonthlyReportKpis reportData={reportData} />

      {/* 3. 3軸集計・費用配賦 & AI モデル別・日別推移チャート */}
      <MonthlyReportCharts reportData={reportData} />

      {/* 4. ユーザー別利用明細テーブル */}
      <MonthlyReportUserTable reportData={reportData} />
    </div>
  );
};
