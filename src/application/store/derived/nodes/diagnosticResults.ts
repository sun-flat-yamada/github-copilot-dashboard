import { DerivedDataNode } from '../DerivedDataGraph.js';
import { DataStoreState } from '../../DataStoreState.js';
import { UserDiagnosticResult } from '../../../../domain/entities/deep-analysis.js';
import { InefficiencyDiagnosticEngine } from '../../../../processor/inefficiency-diagnostic.js';

export const diagnosticResultsNode: DerivedDataNode<Map<string, UserDiagnosticResult>> = {
  id: 'diagnosticResults',
  dependencies: ['deepAnalysisProfiles', 'selectedTags'],
  compute(state: DataStoreState): Map<string, UserDiagnosticResult> {
    const results = new Map<string, UserDiagnosticResult>();
    const { deepAnalysisProfiles, selectedTags } = state;

    if (!deepAnalysisProfiles || deepAnalysisProfiles.length === 0) {
      return results;
    }

    let profiles = deepAnalysisProfiles;
    if (selectedTags.length > 0) {
      profiles = profiles.filter((p) => {
        if (!p.tags || p.tags.length === 0) return false;
        return selectedTags.every((t) => p.tags!.includes(t));
      });
    }

    for (const profile of profiles) {
      try {
        const diag = InefficiencyDiagnosticEngine.diagnoseUser(profile, '30d');
        results.set(profile.login.toLowerCase(), diag);
      } catch {
        // Skip on corrupted profile
      }
    }

    return results;
  },
};
