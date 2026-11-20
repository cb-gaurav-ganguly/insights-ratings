import type { PARCell } from "./types";

export const PHASES = ["powerplay", "middle", "death"] as const;

export interface DerivedPAR {
  strikeRate: number | null;
  runsPerOver: number | null;
  ballsPerWicket: number | null;
}

// Mirrors matchperformance.DerivePAR in insights-emerald.
export function derivePAR(cell: PARCell): DerivedPAR {
  return {
    strikeRate: cell.ballsFaced > 0 ? (100 * cell.batRuns) / cell.ballsFaced : null,
    runsPerOver: cell.legalBalls > 0 ? (6 * cell.chargedRuns) / cell.legalBalls : null,
    ballsPerWicket: cell.dismissals > 0 ? cell.ballsFaced / cell.dismissals : null,
  };
}
