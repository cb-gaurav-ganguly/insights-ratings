import type { ReactNode } from "react";
import type { Commentary, InfoResponse, LivescoreResponse, MiniBatter, MiniBowler } from "../types";
import type { Source } from "../usePanelData";
import { parseBall } from "../scorecardUtils";
import { SourceError } from "./SourceError";

interface Props {
  live: Source<LivescoreResponse>;
  info: InfoResponse | undefined;
}

const fmt = (n: number | undefined, digits = 2) => (n === undefined || n === null ? "—" : n.toFixed(digits));

// Commentary marks bold spans with placeholders such as B0$; safely replace them with their values.
export function CommentaryText({ item }: { item: Commentary }) {
  const bold = item.commentaryFormats?.bold;
  if (!bold || !Array.isArray(bold.formatId) || bold.formatId.length === 0 || !item.commText) {
    return <>{item.commText ?? ""}</>;
  }
  const escapedIds = bold.formatId.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  if (escapedIds.length === 0) return <>{item.commText}</>;
  const pattern = new RegExp(`(${escapedIds.join("|")})`);
  const parts: ReactNode[] = [];
  item.commText.split(pattern).forEach((part, index) => {
    const at = bold.formatId.indexOf(part);
    parts.push(at >= 0 && bold.formatValue?.[at] !== undefined ? <strong key={index}>{bold.formatValue[at]}</strong> : part);
  });
  return <>{parts}</>;
}

function BatterRow({ batter, striker }: { batter?: MiniBatter; striker?: boolean }) {
  if (!batter) return null;
  return (
    <tr className={striker ? "row-striker" : undefined}>
      <td className="name">
        {batter.batName}
        {striker && (
          <span className="strike" title="On strike" aria-label="On strike">
            *
          </span>
        )}
      </td>
      <td className="num strong">{batter.batRuns}</td>
      <td className="num">{batter.batBalls}</td>
      <td className="num">{batter.batFours}</td>
      <td className="num">{batter.batSixes}</td>
      <td className="num">{fmt(batter.batStrikeRate, 1)}</td>
    </tr>
  );
}

function BowlerRow({ bowler, current }: { bowler?: MiniBowler; current?: boolean }) {
  if (!bowler) return null;
  return (
    <tr className={current ? "row-bowling" : undefined}>
      <td className="name">
        {bowler.bowlName}
        {current && (
          <span className="strike" title="Current bowler" aria-label="Current bowler">
            *
          </span>
        )}
      </td>
      <td className="num">{bowler.bowlOvs}</td>
      <td className="num">{bowler.bowlMaidens}</td>
      <td className="num">{bowler.bowlRuns}</td>
      <td className="num strong">{bowler.bowlWkts}</td>
      <td className="num">{fmt(bowler.bowlEcon)}</td>
    </tr>
  );
}

function RecentBalls({ text }: { text?: string }) {
  if (!text) return null;
  const rawTokens = text.trim().split(/\s+/).filter(Boolean);
  // Keep the recent 14 delivery tokens including over break pipes to preserve over boundaries.
  const tokens = rawTokens.slice(-14).map(parseBall);
  return (
    <div className="recent" aria-label="Recent deliveries">
      <span className="recent-label">Recent:</span>
      <div className="recent-list">
        {tokens.map((b, i) =>
          b.kind === "separator" ? (
            <span key={i} className="over-divider" title="Over break" aria-hidden="true" />
          ) : (
            <span
              key={i}
              className={`ball ball-${b.kind}`}
              title={
                b.kind === "w" ? "Wicket" :
                b.kind === "four" ? "Four runs" :
                b.kind === "six" ? "Six runs" :
                b.kind === "extra" ? `Extra (${b.text})` :
                b.kind === "dot" ? "Dot ball" :
                `${b.text} run${b.text === "1" ? "" : "s"}`
              }
            >
              {b.text}
            </span>
          )
        )}
      </div>
    </div>
  );
}

export default function Scorecard({ live, info }: Props) {
  const mini = live.data?.miniscore;
  const scores = [...(mini?.matchScoreDetails?.inningsScoreList ?? [])].sort((a, b) => a.inningsId - b.inningsId);
  const status = mini?.matchScoreDetails?.customStatus || mini?.status || info?.matchInfo.status;
  const latest = live.data?.commentaryList?.[0];
  const teamName = (id: number) =>
    info?.matchInfo.team1.id === id ? info.matchInfo.team1.name : info?.matchInfo.team2.id === id ? info.matchInfo.team2.name : undefined;

  return (
    <section className="card scorecard" aria-labelledby="scorecard-heading">
      <div className="card-head">
        <h2 id="scorecard-heading">Mini scorecard</h2>
        {info && <span className="tag">{info.matchInfo.matchFormat}</span>}
      </div>
      <SourceError error={live.error} hasData={Boolean(live.data)} />
      {!mini ? (
        <div className="empty-substate">
          <p className="muted">No live score yet.</p>
        </div>
      ) : (
        <>
          <div className="innings-list" aria-label="Innings scores">
            {scores.map((inn) => (
              <div key={inn.inningsId} className={`innings ${inn.inningsId === mini.inningsId ? "current" : ""}`}>
                <div className="team">
                  <span className="team-short">{inn.batTeamName || teamName(inn.batTeamId) || `Innings ${inn.inningsId}`}</span>
                  {teamName(inn.batTeamId) && teamName(inn.batTeamId) !== inn.batTeamName && (
                    <span className="team-full muted">{teamName(inn.batTeamId)}</span>
                  )}
                </div>
                <div className="score">
                  {inn.score}
                  <span className="wkts">/{inn.wickets}</span>
                  {inn.isDeclared && <span className="declared" title="Declared"> d</span>}
                  <span className="overs">({inn.overs} ov)</span>
                </div>
              </div>
            ))}
          </div>
          {status && (
            <div className="match-status-banner" role="status">
              <span className="status-indicator-dot" aria-hidden="true" />
              <span className="status-text">{status}</span>
            </div>
          )}

          <div className="rates" aria-label="Run rates and partnerships">
            <div className="rate-chip"><span className="label">CRR</span><span className="rate-val">{fmt(mini.currentRunRate)}</span></div>
            {!!mini.requiredRunRate && (
              <div className="rate-chip"><span className="label">RRR</span><span className="rate-val">{fmt(mini.requiredRunRate)}</span></div>
            )}
            {mini.partnerShip && (
              <div className="rate-chip">
                <span className="label">P'ship</span>
                <span className="rate-val">{mini.partnerShip.runs} <span className="muted small">({mini.partnerShip.balls}b)</span></span>
              </div>
            )}
            {mini.latestPerformance?.map((p) => (
              <div key={p.label} className="rate-chip">
                <span className="label">{p.label}</span>
                <span className="rate-val">{p.runs}/{p.wkts}</span>
              </div>
            ))}
          </div>

          <div className="table-responsive">
            <table className="table compact" aria-label="Current batters">
              <thead>
                <tr>
                  <th scope="col">Batter</th>
                  <th scope="col" className="num">R</th>
                  <th scope="col" className="num">B</th>
                  <th scope="col" className="num">4s</th>
                  <th scope="col" className="num">6s</th>
                  <th scope="col" className="num">SR</th>
                </tr>
              </thead>
              <tbody>
                <BatterRow batter={mini.batsmanStriker} striker />
                <BatterRow batter={mini.batsmanNonStriker} />
              </tbody>
            </table>
          </div>

          <div className="table-responsive">
            <table className="table compact" aria-label="Current bowlers">
              <thead>
                <tr>
                  <th scope="col">Bowler</th>
                  <th scope="col" className="num">O</th>
                  <th scope="col" className="num">M</th>
                  <th scope="col" className="num">R</th>
                  <th scope="col" className="num">W</th>
                  <th scope="col" className="num">Econ</th>
                </tr>
              </thead>
              <tbody>
                <BowlerRow bowler={mini.bowlerStriker} current />
                <BowlerRow bowler={mini.bowlerNonStriker} />
              </tbody>
            </table>
          </div>

          <RecentBalls text={mini.recentOvsStats} />
          {mini.lastWicket && (
            <div className="meta">
              <span className="label">Last wkt:</span>
              <span className="meta-val">{mini.lastWicket.replace(/\s+/g, " ")}</span>
            </div>
          )}
          {latest && (
            <div className="commentary" aria-label="Latest commentary">
              {latest.overNumber !== undefined && <span className="over">{latest.overNumber}</span>}
              <span className="commentary-body"><CommentaryText item={latest} /></span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
