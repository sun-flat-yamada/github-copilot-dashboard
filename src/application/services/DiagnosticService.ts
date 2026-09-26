import { UserUsageProfile } from '../../domain/entities/copilot.js';
import { UserDiagnosticResult } from '../../domain/entities/deep-analysis.js';
import { InefficiencyDiagnosticEngine } from '../../processor/inefficiency-diagnostic.js';

export class DiagnosticService {
  static runDiagnostics(profiles: UserUsageProfile[]): Map<string, UserDiagnosticResult> {
    const results = new Map<string, UserDiagnosticResult>();
    for (const p of profiles) {
      try {
        const diag = InefficiencyDiagnosticEngine.diagnoseUser(p, '30d');
        results.set(p.login.toLowerCase(), diag);
      } catch {
        // Skip corrupted profile
      }
    }
    return results;
  }

  static computeHealthSummary(diagnostics: Map<string, UserDiagnosticResult>): {
    healthy: number;
    warning: number;
    critical: number;
    averageScore: number;
  } {
    let healthy = 0;
    let warning = 0;
    let critical = 0;
    let totalScore = 0;

    for (const diag of diagnostics.values()) {
      totalScore += diag.healthScore;
      if (diag.healthStatus === 'healthy') healthy++;
      else if (diag.healthStatus === 'warning') warning++;
      else critical++;
    }

    const count = diagnostics.size;
    return {
      healthy,
      warning,
      critical,
      averageScore: count > 0 ? Math.round(totalScore / count) : 100,
    };
  }
}
