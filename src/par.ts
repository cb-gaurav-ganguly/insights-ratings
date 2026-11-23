import type { PARCell } from "./types";

export const PHASES = ["powerplay", "middle", "death"] as const;

export interface DerivedPAR {
  strikeRate: number | null;
  runsPerOver: number | null;
  ballsPerWicket: number | null;
}

// Mirrors matchperformance.DerivePAR in insights-emerald.
export function derivePAR(cell: PARCell): DerivedPAR {
  const sr =
    Number.isFinite(cell.ballsFaced) &&
    cell.ballsFaced > 0 &&
    Number.isFinite(cell.batRuns)
      ? (100 * cell.batRuns) / cell.ballsFaced
      : null;
  const rpo =
    Number.isFinite(cell.legalBalls) &&
    cell.legalBalls > 0 &&
    Number.isFinite(cell.chargedRuns)
      ? (6 * cell.chargedRuns) / cell.legalBalls
      : null;
  const bpw =
    Number.isFinite(cell.dismissals) &&
    cell.dismissals > 0 &&
    Number.isFinite(cell.ballsFaced)
      ? cell.ballsFaced / cell.dismissals
      : null;

  return {
    strikeRate: sr !== null && Number.isFinite(sr) ? sr : null,
    runsPerOver: rpo !== null && Number.isFinite(rpo) ? rpo : null,
    ballsPerWicket: bpw !== null && Number.isFinite(bpw) ? bpw : null,
  };
}
