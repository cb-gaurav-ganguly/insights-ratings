import { useEffect, useRef, useState } from "react";
import type { InfoPlayer, InfoResponse, InfoTeam, PlayerRating, RatingStateResponse } from "../types";
import type { Source } from "../usePanelData";
import { SourceError } from "./SourceError";

type SortKey = "order" | "rating";

interface Props {
  info: Source<InfoResponse>;
  rating: Source<RatingStateResponse | null>;
}

const FLASH_MS = 4000;

// Players whose updatedByEventId changed on the latest refresh, kept briefly for the highlight.
function useChangedPlayers(players: Record<string, PlayerRating> | undefined) {
  const previous = useRef<Record<string, string> | undefined>(undefined);
  const [changed, setChanged] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!players) return;
    const next: Record<string, string> = {};
    const fresh: string[] = [];
    for (const [id, player] of Object.entries(players)) {
      next[id] = player.updatedByEventId;
      if (previous.current && previous.current[id] !== player.updatedByEventId) fresh.push(id);
    }
    previous.current = next;
    if (fresh.length === 0) return;
    const now = Date.now();
    setChanged((current) => ({ ...current, ...Object.fromEntries(fresh.map((id) => [id, now])) }));
    const timer = window.setTimeout(() => {
      setChanged((current) =>
        Object.fromEntries(Object.entries(current).filter(([, at]) => Date.now() - at < FLASH_MS)),
      );
    }, FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [players]);

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
    return <span className={`status-chip ${rating.status.toLowerCase()}`}>{rating.status.toLowerCase()}</span>;
  }
  const c = rating.components;
  const title = c
    ? `Score ${rating.score?.toFixed(2)}\nBatting ${c.batting.toFixed(2)}\nBowling ${c.bowling.toFixed(2)}\nFielding ${c.fielding.toFixed(2)}\nImpact ${c.impact.toFixed(2)}`
    : undefined;
  return (
    <div className="rating" title={title}>
      <span className={`rating-value ${ratingTone(rating.rating)}`}>{rating.rating.toFixed(1)}</span>
      <span className="rating-bar">
        <span className={`fill ${ratingTone(rating.rating)}`} style={{ width: `${rating.rating * 10}%` }} />
      </span>
    </div>
  );
}

function Components({ rating }: { rating?: PlayerRating }) {
  const c = rating?.components;
  if (!c) return <span className="muted small">—</span>;
  const item = (label: string, value: number) => (
    <span className={`comp ${value > 0 ? "pos" : value < 0 ? "neg" : ""}`} title={label}>
      {label[0]}
      <b>{value > 0 ? "+" : ""}{value.toFixed(1)}</b>
    </span>
  );
  return (
    <div className="components">
      {item("Batting", c.batting)}
      {item("Bowling", c.bowling)}
      {item("Fielding", c.fielding)}
      {item("Impact", c.impact)}
    </div>
  );
}

function TeamSquad({ team, players, changed, sort }: {
  team: InfoTeam;
  players: Record<string, PlayerRating>;
  changed: Record<string, number>;
  sort: SortKey;
}) {
  const squad = team.playerDetails.filter((p) => !p.isSupportStaff);
  // Playing XI, plus any substitute who has a rating entry (impact or concussion replacement).
  const xi = squad.filter((p) => !p.substitute || players[String(p.id)]);
  const order = new Map(xi.map((p, i) => [p.id, i]));
  const rows = [...xi].sort((a, b) => {
    if (sort === "rating") {
      const ra = players[String(a.id)]?.rating ?? -1;
      const rb = players[String(b.id)]?.rating ?? -1;
      if (ra !== rb) return rb - ra;
    }
    return order.get(a.id)! - order.get(b.id)!;
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
      <table className="table squad-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Rating</th>
            <th className="hide-sm">Components</th>
            <th className="num">Bat. quality</th>
            <th className="hide-sm">Updated by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((player) => (
            <PlayerRow key={player.id} player={player} rating={players[String(player.id)]} flash={!!changed[String(player.id)]} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerRow({ player, rating, flash }: { player: InfoPlayer; rating?: PlayerRating; flash: boolean }) {
  return (
    <tr className={flash ? "flash" : ""}>
      <td>
        <div className="player">
          <span className="player-name">
            {player.name}
            {player.captain && <span className="badge" title="Captain">C</span>}
            {player.keeper && <span className="badge" title="Wicket-keeper">WK</span>}
            {player.substitute && <span className="badge sub" title="Substitute">SUB</span>}
          </span>
          <span className="player-role muted">{player.role}</span>
        </div>
      </td>
      <td><RatingCell rating={rating} /></td>
      <td className="hide-sm"><Components rating={rating} /></td>
      <td className="num">
        {typeof rating?.battingQuality === "number" ? rating.battingQuality.toFixed(3) : <span className="muted">—</span>}
      </td>
      <td className="hide-sm mono small muted event-id" title={rating?.updatedByEventId}>
        {rating?.updatedByEventId || "—"}
      </td>
    </tr>
  );
}

export default function Squads({ info, rating }: Props) {
  const [sort, setSort] = useState<SortKey>("order");
  const ratings = rating.data?.ratings;
  const players = ratings?.players ?? {};
  const changed = useChangedPlayers(ratings?.players);
  const match = info.data?.matchInfo;

  return (
    <section className="card squads">
      <div className="card-head">
        <h2>Playing XI &amp; ratings</h2>
        <div className="card-actions">
          {ratings && <span className="muted small">Calculated {new Date(ratings.calculatedAt).toLocaleTimeString()}</span>}
          <div className="segmented" role="group" aria-label="Sort players">
            <button type="button" className={sort === "order" ? "active" : ""} onClick={() => setSort("order")}>Squad order</button>
            <button type="button" className={sort === "rating" ? "active" : ""} onClick={() => setSort("rating")}>Rating</button>
          </div>
        </div>
      </div>
      <SourceError error={info.error} />
      {!ratings && rating.data !== undefined && (
        <p className="muted small">No player ratings yet. They appear after the first over-break.</p>
      )}
      {!match ? (
        <p className="muted">Squad not available.</p>
      ) : (
        <div className="squad-grid">
          <TeamSquad team={match.team1} players={players} changed={changed} sort={sort} />
          <TeamSquad team={match.team2} players={players} changed={changed} sort={sort} />
        </div>
      )}
    </section>
  );
}
