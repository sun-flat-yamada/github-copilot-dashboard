import { DerivedDataGraph } from '../DerivedDataGraph.js';
import { filteredScopeDataNode } from './filteredScopeData.js';
import { filteredReportDataNode } from './filteredReportData.js';
import { activeDataForViewNode } from './activeDataForView.js';
import { availableTagsNode } from './availableTags.js';
import { availableGroupsNode } from './availableGroups.js';
import { diagnosticResultsNode } from './diagnosticResults.js';

export function registerCoreDerivedNodes(graph: DerivedDataGraph): void {
  graph.registerNode(filteredScopeDataNode);
  graph.registerNode(filteredReportDataNode);
  graph.registerNode(activeDataForViewNode);
  graph.registerNode(availableTagsNode);
  graph.registerNode(availableGroupsNode);
  graph.registerNode(diagnosticResultsNode);
}

export {
  filteredScopeDataNode,
  filteredReportDataNode,
  activeDataForViewNode,
  availableTagsNode,
  availableGroupsNode,
  diagnosticResultsNode,
};
