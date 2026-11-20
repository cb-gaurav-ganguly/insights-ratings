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
    <header className="header">
      <div className="brand">
        <span className="logo">◆</span>
        <div>
          <div className="brand-title">Insights Ratings</div>
          {match ? (
            <div className="brand-sub">
              {match.team1.shortName} v {match.team2.shortName} · {match.matchDescription} · {match.series.name}
              <span className="muted"> · {match.venue.name}, {match.venue.city}</span>
            </div>
          ) : (
            <div className="brand-sub muted">Live score, PAR and player ratings</div>
          )}
        </div>
      </div>

      <div className="controls">
        {matchId !== undefined && (
          <div className={`pill pill-${liveState}`} title={errors.join("\n") || undefined}>
            <span className="dot" />
            {liveState === "live" && "Live"}
            {liveState === "paused" && "Paused"}
            {liveState === "stale" && "Stale"}
            {liveState === "degraded" && `${errors.length} source${errors.length > 1 ? "s" : ""} failing`}
            {ago !== undefined && <span className="muted"> · {ago}s ago</span>}
          </div>
        )}
        {matchId !== undefined && (
          <button className="btn ghost" onClick={onTogglePause} type="button">
            {paused ? "Resume" : "Pause"}
          </button>
        )}
        <form onSubmit={submit} className="match-form">
          <input
            inputMode="numeric"
            placeholder="Match ID"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            aria-label="Match ID"
          />
          <button className="btn" type="submit">Load</button>
        </form>
      </div>
    </header>
  );
}
