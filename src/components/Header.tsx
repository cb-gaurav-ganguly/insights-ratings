import { useEffect, useState, type FormEvent } from "react";
import type { InfoResponse } from "../types";
import { REFRESH_MS } from "../usePanelData";

interface Props {
  matchId: number | undefined;
  onMatchId: (id: number | undefined) => void;
  paused: boolean;
  onTogglePause: () => void;
  lastUpdated: number | undefined;
  info: InfoResponse | undefined;
  errors: string[];
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function Header({ matchId, onMatchId, paused, onTogglePause, lastUpdated, info, errors }: Props) {
  const [draft, setDraft] = useState(matchId ? String(matchId) : "");
  const now = useNow(1000);
  useEffect(() => setDraft(matchId ? String(matchId) : ""), [matchId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(draft.trim());
    onMatchId(Number.isInteger(value) && value > 0 ? value : undefined);
  };

  const match = info?.matchInfo;
  const ago = lastUpdated ? Math.max(0, Math.round((now - lastUpdated) / 1000)) : undefined;
  const stale = ago !== undefined && ago * 1000 > REFRESH_MS * 3;
  const liveState = paused ? "paused" : errors.length ? "degraded" : stale ? "stale" : "live";

  return (
    <header className="header" role="banner">
      <div className="brand">
        <span className="logo" aria-hidden="true">◆</span>
        <div className="brand-content">
          <div className="brand-header-line">
            <h1 className="brand-title">Insights Ratings</h1>
            {match && (
              <span className="header-match-teams">
                {match.team1.shortName} <span className="vs-sep">vs</span> {match.team2.shortName}
              </span>
            )}
          </div>
          {match ? (
            <div className="brand-sub">
              <span className="meta-item format-badge">{match.matchFormat}</span>
              <span className="meta-item">{match.matchDescription}</span>
              <span className="meta-item muted">· {match.series.name}</span>
              <span className="meta-item muted">· {match.venue.name}, {match.venue.city}</span>
              {match.tossResults && (
                <span className="meta-item toss-note">({match.tossResults.tossWinnerName} chose to {match.tossResults.decision?.toLowerCase()})</span>
              )}
            </div>
          ) : (
            <div className="brand-sub muted">Live match score, PAR benchmarks and player ratings</div>
          )}
        </div>
      </div>

      <div className="controls">
        {matchId !== undefined && (
          <div
            className={`pill pill-${liveState}`}
            title={errors.length > 0 ? `Errors:\n${errors.join("\n")}` : undefined}
          >
            <span className="pill-status" role="status" aria-live="polite">
              <span className="dot" aria-hidden="true" />
              <span className="pill-label">
                {liveState === "live" && "Live"}
                {liveState === "paused" && "Paused"}
                {liveState === "stale" && "Stale"}
                {liveState === "degraded" && `${errors.length} source${errors.length > 1 ? "s" : ""} failing`}
              </span>
            </span>
            {ago !== undefined && <span className="muted ago-time"> · {ago}s ago</span>}
          </div>
        )}
        {matchId !== undefined && (
          <button
            className={`btn ghost ${paused ? "btn-resume" : ""}`}
            onClick={onTogglePause}
            type="button"
            aria-label={paused ? "Resume live polling" : "Pause live polling"}
          >
            {paused ? "Resume" : "Pause"}
          </button>
        )}
        <form onSubmit={submit} className="match-form" role="search" aria-label="Load Match by ID">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Match ID"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            aria-label="Match ID"
          />
          <button className="btn" type="submit" disabled={!draft.trim()}>
            Load
          </button>
        </form>
      </div>
    </header>
  );
}
