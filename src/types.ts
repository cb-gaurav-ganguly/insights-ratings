// Shapes of the three upstream responses, limited to the fields the panel reads.

export interface InfoPlayer {
  id: number;
  name: string;
  fullName?: string;
  role?: string;
  captain?: boolean;
  keeper?: boolean;
  substitute?: boolean;
  isSupportStaff?: boolean;
  playingXIChange?: "IN" | "OUT";
  battingStyle?: string;
  bowlingStyle?: string;
}

export interface InfoTeam {
  id: number;
  name: string;
  shortName: string;
  playerDetails: InfoPlayer[];
}

export interface InfoResponse {
  matchInfo: {
    matchId: number;
    matchDescription: string;
    matchFormat: string;
    state: string;
    status: string;
    shortStatus?: string;
    series: { id: number; name: string };
    venue: { name: string; city: string };
    team1: InfoTeam;
    team2: InfoTeam;
    tossResults?: { tossWinnerName: string; decision: string };
  };
}

export interface MiniBatter {
  batId: number;
  batName: string;
  batRuns: number;
  batBalls: number;
  batFours: number;
  batSixes: number;
  batStrikeRate: number;
}

export interface MiniBowler {
  bowlId: number;
  bowlName: string;
  bowlOvs: number;
  bowlMaidens: number;
  bowlRuns: number;
  bowlWkts: number;
  bowlEcon: number;
}

export interface InningsScore {
  inningsId: number;
  batTeamId: number;
  batTeamName: string;
  score: number;
  wickets: number;
  overs: number;
  isDeclared: boolean;
}

export interface Commentary {
  commText: string;
  overNumber?: number;
  event?: string;
  timestamp: number;
  commentaryFormats?: { bold?: { formatId: string[]; formatValue: string[] } };
}

export interface LivescoreResponse {
  commentaryList?: Commentary[];
  miniscore?: {
    inningsId: number;
    batsmanStriker?: MiniBatter;
    batsmanNonStriker?: MiniBatter;
    bowlerStriker?: MiniBowler;
    bowlerNonStriker?: MiniBowler;
    overs: number;
    recentOvsStats?: string;
    partnerShip?: { balls: number; runs: number };
    currentRunRate?: number;
    requiredRunRate?: number;
    lastWicket?: string;
    status?: string;
    event?: string;
    matchScoreDetails?: {
      inningsScoreList: InningsScore[];
      state: string;
      customStatus?: string;
      highlightedTeamId?: number;
    };
    latestPerformance?: { runs: number; wkts: number; label: string }[];
  };
}

// insights-emerald GET /b/insights/v1/player-ratings?matchId=
export interface PARCell {
  innings: number;
  phase: "powerplay" | "middle" | "death" | string;
  batRuns: number;
  ballsFaced: number;
  chargedRuns: number;
  legalBalls: number;
  dismissals: number;
  sourceLevel: string;
}

export interface PARSnapshot {
  matchId: number;
  formatId: number;
  startDate: string;
  preparedAt: string;
  cells: PARCell[];
}

export interface RatingComponents {
  batting: number;
  bowling: number;
  fielding: number;
  impact: number;
}

export interface PlayerRating {
  status: "RATED" | "UNRATED" | "INVALID" | string;
  rating: number | null;
  score: number | null;
  components: RatingComponents | null;
  updatedByEventId: string;
}

export interface RatingsSnapshot {
  matchId: number;
  format: string;
  calculatedAt: string;
  parPreparedAt: string;
  players: Record<string, PlayerRating>;
}

export interface RatingStateResponse {
  matchId: number;
  par: PARSnapshot | null;
  ratings: RatingsSnapshot | null;
  // Player id → stored Batting Quality. Players without one are absent; null when MariaDB could not be read.
  battingQualities?: Record<string, number> | null;
}
