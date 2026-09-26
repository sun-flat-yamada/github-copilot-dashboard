import React from 'react';
import { ViewPlugin, ViewPluginProps } from './ViewPlugin.js';
import { AgentPresenter, AgentViewModel } from '../presenters/AgentPresenter.js';
import { AgentActivityView } from '../../../dashboard/src/components/views/AgentActivityView.js';

export const AgentViewComponent: React.FC<ViewPluginProps<AgentViewModel>> = (props) => {
  const { presenter, currentData, agentAdoption } = props;
  const viewModel = presenter ?? AgentPresenter.present({
    currentData,
    agentAdoption,
  });

  return <AgentActivityView viewModel={viewModel} />;
};

export const AgentViewPlugin: ViewPlugin<AgentViewModel> = {
  id: 'agent',
  label: 'AI Agent & MCP 活用動向',
  title: 'AI Agent & MCP 活用動向',
  shortTitle: 'Agent活用',
  description: 'VS Code Agent・カスタムAgent・MCPツール呼出・Coding Agent PRの統合分析',
  icon: 'Bot',
  iconName: 'Bot',
  order: 8,
  capabilities: ['agent_activity'],
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  badge: 'New',
  badgeColor: 'purple',
  canRender: (_state: any) => true,
  requiredDerivedData: () => ['agentAdoption'],
  presenterFactory: (data: any) => AgentPresenter.present(data),
  component: AgentViewComponent,
};
