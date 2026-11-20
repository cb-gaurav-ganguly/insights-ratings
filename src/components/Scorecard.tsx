import type { ReactNode } from "react";
import type { Commentary, InfoResponse, LivescoreResponse, MiniBatter, MiniBowler } from "../types";
import type { Source } from "../usePanelData";
import { SourceError } from "./SourceError";

interface Props {
  live: Source<LivescoreResponse>;
  info: InfoResponse | undefined;
}

const fmt = (n: number | undefined, digits = 2) => (n === undefined || n === null ? "—" : n.toFixed(digits));

// Commentary marks bold spans with placeholders such as B0$; replace them with their values.
function CommentaryText({ item }: { item: Commentary }) {
  const bold = item.commentaryFormats?.bold;
  if (!bold) return <>{item.commText}</>;
  const parts: ReactNode[] = [];
  const pattern = new RegExp(`(${bold.formatId.map((id) => id.replace(/\$/g, "\\$")).join("|")})`);
  item.commText.split(pattern).forEach((part, index) => {
    const at = bold.formatId.indexOf(part);
    parts.push(at >= 0 ? <strong key={index}>{bold.formatValue[at]}</strong> : part);
  });
  return <>{parts}</>;
}

function BatterRow({ batter, striker }: { batter?: MiniBatter; striker?: boolean }) {
  if (!batter) return null;
  return (
    <tr>
      <td className="name">{batter.batName}{striker && <span className="strike">*</span>}</td>
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
    <tr>
      <td className="name">{bowler.bowlName}{current && <span className="strike">*</span>}</td>
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
  const balls = text.split(/\s+/).filter((b) => b && b !== "|");
  return (
    <div className="recent">
      {balls.slice(-12).map((ball, i) => {
        const kind = /W/.test(ball) ? "w" : ball === "4" ? "four" : ball === "6" ? "six" : "";
        return <span key={i} className={`ball ${kind}`}>{ball}</span>;
      })}
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
    <section className="card scorecard">
      <div className="card-head">
        <h2>Mini scorecard</h2>
        {info && <span className="tag">{info.matchInfo.matchFormat}</span>}
      </div>
      <SourceError error={live.error} />
      {!mini ? (
        <p className="muted">No live score yet.</p>
      ) : (
        <>
          <div className="innings-list">
            {scores.map((inn) => (
              <div key={inn.inningsId} className={`innings ${inn.inningsId === mini.inningsId ? "current" : ""}`}>
                <div className="team">
                  <span className="team-short">{inn.batTeamName}</span>
                  <span className="team-full muted">{teamName(inn.batTeamId)}</span>
                </div>
                <div className="score">
                  {inn.score}<span className="wkts">/{inn.wickets}</span>
                  <span className="overs">({inn.overs} ov)</span>
                </div>
              </div>
            ))}
          </div>
          {status && <div className="status">{status}</div>}

          <div className="rates">
            <div><span className="label">CRR</span>{fmt(mini.currentRunRate)}</div>
            {!!mini.requiredRunRate && <div><span className="label">RRR</span>{fmt(mini.requiredRunRate)}</div>}
            {mini.partnerShip && (
              <div><span className="label">P'ship</span>{mini.partnerShip.runs} ({mini.partnerShip.balls})</div>
            )}
            {mini.latestPerformance?.map((p) => (
              <div key={p.label}><span className="label">{p.label}</span>{p.runs}/{p.wkts}</div>
            ))}
          </div>

          <table className="table compact">
            <thead>
              <tr><th>Batter</th><th className="num">R</th><th className="num">B</th><th className="num">4s</th><th className="num">6s</th><th className="num">SR</th></tr>
            </thead>
            <tbody>
              <BatterRow batter={mini.batsmanStriker} striker />
              <BatterRow batter={mini.batsmanNonStriker} />
            </tbody>
          </table>
          <table className="table compact">
            <thead>
              <tr><th>Bowler</th><th className="num">O</th><th className="num">M</th><th className="num">R</th><th className="num">W</th><th className="num">Econ</th></tr>
            </thead>
            <tbody>
              <BowlerRow bowler={mini.bowlerStriker} current />
              <BowlerRow bowler={mini.bowlerNonStriker} />
            </tbody>
          </table>

          <RecentBalls text={mini.recentOvsStats} />
          {mini.lastWicket && <div className="meta"><span className="label">Last wkt</span>{mini.lastWicket.replace(/\s+/g, " ")}</div>}
          {latest && (
            <div className="commentary">
              {latest.overNumber !== undefined && <span className="over">{latest.overNumber}</span>}
              <CommentaryText item={latest} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
