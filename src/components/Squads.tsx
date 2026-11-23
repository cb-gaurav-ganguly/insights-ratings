import { useEffect, useRef, useState } from "react";
import type { InfoPlayer, InfoResponse, InfoTeam, PlayerRating, RatingStateResponse } from "../types";
import type { Source } from "../usePanelData";
import { FLASH_MS, pruneExpiredFlashes, calculateFlashDelay } from "../flashUtils";
import { SourceError } from "./SourceError";

type SortKey = "order" | "rating";

interface Props {
  info: Source<InfoResponse>;
  rating: Source<RatingStateResponse | null>;
  activeAction: "postscore" | "match-header" | null;
  actionError: string | undefined;
  onRefreshTillNow: () => Promise<void>;
  onSetupParAndQuality: () => Promise<void>;
}

function formatTime(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "—";
  }
}

// Players whose updatedByEventId changed on the latest refresh, kept briefly for the highlight.
export function useChangedPlayers(players: Record<string, PlayerRating> | undefined) {
  const previous = useRef<Record<string, string> | undefined>(undefined);
  const [changed, setChanged] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!players) return;
    const next: Record<string, string> = {};
    const fresh: string[] = [];
    for (const [id, player] of Object.entries(players)) {
      if (!player) continue;
      next[id] = player.updatedByEventId;
      // Only highlight if there was a prior record and event ID changed to a non-empty string.
      if (previous.current && previous.current[id] && previous.current[id] !== player.updatedByEventId) {
        fresh.push(id);
      }
    }
    previous.current = next;
    if (fresh.length > 0) {
      const now = Date.now();
      setChanged((curr) => ({ ...curr, ...Object.fromEntries(fresh.map((id) => [id, now])) }));
    }
  }, [players]);

  // Cleanly prune expired flashes without timer loss when new player props arrive.
  useEffect(() => {
    const keys = Object.keys(changed);
    if (keys.length === 0) return;
    const now = Date.now();
    const delay = calculateFlashDelay(changed, now, FLASH_MS);
    const timer = window.setTimeout(() => {
      const checkNow = Date.now();
      setChanged((curr) => {
        const { next, didChange } = pruneExpiredFlashes(curr, checkNow, FLASH_MS);
        return didChange ? next : curr;
      });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [changed]);

  return changed;
}

function ratingTone(value: number) {
  if (value >= 8) return "excellent";
  if (value >= 6.5) return "good";
  if (value >= 4.5) return "average";
  return "poor";
}

function RatingCell({ rating }: { rating?: PlayerRating }) {
  if (!rating) return <span className="muted small">—</span>;
  if (rating.status !== "RATED" || rating.rating === null) {
    const statusText = rating.status?.toLowerCase() ?? "unrated";
    return <span className={`status-chip ${statusText}`}>{statusText}</span>;
  }
  const c = rating.components;
  const title = c
    ? `Score ${rating.score?.toFixed(2) ?? "—"}\nBatting ${c.batting.toFixed(2)}\nBowling ${c.bowling.toFixed(2)}\nFielding ${c.fielding.toFixed(2)}\nImpact ${c.impact.toFixed(2)}`
    : undefined;
  const tone = ratingTone(rating.rating);
  const clampedWidth = Math.max(0, Math.min(100, rating.rating * 10));

  return (
    <div className="rating" title={title} aria-label={`Rating ${rating.rating.toFixed(1)} out of 10`}>
      <span className={`rating-value ${tone}`}>{rating.rating.toFixed(1)}</span>
      <span className="rating-bar" aria-hidden="true">
        <span className={`fill ${tone}`} style={{ width: `${clampedWidth}%` }} />
      </span>
    </div>
  );
}

function Components({ rating }: { rating?: PlayerRating }) {
  const c = rating?.components;
  if (!c) return <span className="muted small">—</span>;
  const item = (label: string, key: string, value: number) => (
    <span className={`comp ${value > 0 ? "pos" : value < 0 ? "neg" : ""}`} title={`${label}: ${value.toFixed(2)}`}>
      <span className="comp-label">{key}</span>
      <b>{value.toFixed(1)}</b>
    </span>
  );
  return (
    <div className="components" aria-label="Rating components">
      {item("Batting", "Bat", c.batting)}
      {item("Bowling", "Bowl", c.bowling)}
      {item("Fielding", "Fld", c.fielding)}
      {item("Impact", "Imp", c.impact)}
    </div>
  );
}

function TeamSquad({ team, players, changed, sort }: {
  team: InfoTeam;
  players: Record<string, PlayerRating>;
  changed: Record<string, number>;
  sort: SortKey;
}) {
  const squad = (team.playerDetails ?? []).filter((p) => !p.isSupportStaff);
  // Playing XI, plus any substitute who has a rating entry (impact or concussion replacement).
  const xi = squad.filter((p) => !p.substitute || players[String(p.id)]);
  const order = new Map(xi.map((p, i) => [p.id, i]));
  const rows = [...xi].sort((a, b) => {
    if (sort === "rating") {
      const ra = players[String(a.id)]?.rating ?? -1;
      const rb = players[String(b.id)]?.rating ?? -1;
      if (ra !== rb) return rb - ra;
    }
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });
  const rated = xi.map((p) => players[String(p.id)]?.rating).filter((r): r is number => typeof r === "number");
  const average = rated.length ? rated.reduce((s, r) => s + r, 0) / rated.length : undefined;

  return (
    <div className="team-squad">
      <div className="team-squad-head">
        <h3>{team.name}</h3>
        <span className="muted small">
          {rated.length}/{xi.length} rated{average !== undefined && ` · avg ${average.toFixed(1)}`}
        </span>
      </div>
      <div className="table-responsive">
        <table className="table squad-table" aria-label={`${team.name} player ratings`}>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Rating</th>
              <th scope="col" className="hide-sm">Components</th>
              <th scope="col" className="num">Bat. quality</th>
              <th scope="col" className="hide-sm">Updated by</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((player) => (
              <PlayerRow key={player.id} player={player} rating={players[String(player.id)]} flash={!!changed[String(player.id)]} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({ player, rating, flash }: { player: InfoPlayer; rating?: PlayerRating; flash: boolean }) {
  return (
    <tr className={flash ? "flash" : undefined}>
      <td>
        <div className="player">
          <span className="player-name">
            {player.name}
            {player.captain && <span className="badge badge-c" title="Captain" aria-label="Captain">C</span>}
            {player.keeper && <span className="badge badge-wk" title="Wicket-keeper" aria-label="Wicket-keeper">WK</span>}
            {player.substitute && <span className="badge sub" title="Substitute" aria-label="Substitute">SUB</span>}
          </span>
          <span className="player-role muted">{player.role || "Player"}</span>
        </div>
      </td>
      <td><RatingCell rating={rating} /></td>
      <td className="hide-sm"><Components rating={rating} /></td>
      <td className="num">
        {typeof rating?.battingQuality === "number" ? rating.battingQuality.toFixed(3) : <span className="muted">—</span>}
      </td>
      <td className="hide-sm mono small muted event-id">
        {rating?.updatedByEventId || "—"}
      </td>
    </tr>
  );
}

export default function Squads({ info, rating, activeAction, actionError, onRefreshTillNow, onSetupParAndQuality }: Props) {
  const [sort, setSort] = useState<SortKey>("order");
  const ratings = rating.data?.ratings;
  const players = ratings?.players ?? {};
  const changed = useChangedPlayers(ratings?.players);
  const match = info.data?.matchInfo;

  return (
    <section className="card squads" aria-labelledby="squads-heading">
      <div className="card-head">
        <h2 id="squads-heading">Playing XI &amp; ratings</h2>
        <div className="card-actions">
          {ratings && <span className="muted small">Calculated {formatTime(ratings.calculatedAt)}</span>}
          <button className="btn btn-sm" type="button" onClick={onSetupParAndQuality} disabled={activeAction !== null}>
            {activeAction === "match-header" ? "Setting up…" : "Setup PAR and Quality"}
          </button>
          <button className="btn btn-sm" type="button" onClick={onRefreshTillNow} disabled={activeAction !== null}>
            {activeAction === "postscore" ? "Refreshing…" : "Refresh till now"}
          </button>
          <div className="segmented" role="group" aria-label="Sort players">
            <button
              type="button"
              className={sort === "order" ? "active" : ""}
              onClick={() => setSort("order")}
              aria-pressed={sort === "order"}
            >
              Squad order
            </button>
            <button
              type="button"
              className={sort === "rating" ? "active" : ""}
              onClick={() => setSort("rating")}
              aria-pressed={sort === "rating"}
            >
              Rating
            </button>
          </div>
        </div>
      </div>
      {actionError && <div className="source-error" role="alert">{actionError}</div>}
      <SourceError error={info.error} hasData={Boolean(info.data)} />
      {!ratings && rating.data !== undefined && (
        <p className="muted small">No player ratings yet. They appear after the first over-break.</p>
      )}
      {!match ? (
        <div className="empty-substate">
          <p className="muted">Squad not available.</p>
        </div>
      ) : (
        <div className="squad-grid">
          {match.team1 && <TeamSquad team={match.team1} players={players} changed={changed} sort={sort} />}
          {match.team2 && <TeamSquad team={match.team2} players={players} changed={changed} sort={sort} />}
        </div>
      )}
    </section>
  );
}
