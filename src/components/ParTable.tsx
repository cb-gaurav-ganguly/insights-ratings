import { derivePAR, PHASES } from "../par";
import type { RatingStateResponse } from "../types";
import type { Source } from "../usePanelData";
import { SourceError } from "./SourceError";

const fmt = (n: number | null, digits: number) => (n === null ? "—" : n.toFixed(digits));
const time = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—");

export default function ParTable({ rating }: { rating: Source<RatingStateResponse | null> }) {
  const par = rating.data?.par;
  return (
    <section className="card par">
      <div className="card-head">
        <h2>PAR table</h2>
        {par && <span className="muted small">Prepared {time(par.preparedAt)}</span>}
      </div>
      <SourceError error={rating.error} />
      {!par ? (
        <p className="muted">No PAR snapshot for this match yet. It is prepared on match-setup.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Inn</th>
              <th>Phase</th>
              <th className="num" title="Par batting strike rate: 100 × bat runs ÷ balls faced">Strike rate</th>
              <th className="num" title="Par runs per over: 6 × charged runs ÷ legal balls">Runs / over</th>
              <th className="num" title="Balls faced ÷ dismissals">Balls / wkt</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2].flatMap((innings) =>
              PHASES.map((phase, index) => {
                const cell = par.cells.find((c) => c.innings === innings && c.phase === phase);
                const derived = cell ? derivePAR(cell) : undefined;
                return (
                  <tr key={`${innings}-${phase}`} className={index === 0 ? "group-start" : ""}>
                    <td className="muted">{index === 0 ? innings : ""}</td>
                    <td className="phase">{phase}</td>
                    <td className="num strong">{derived ? fmt(derived.strikeRate, 1) : "—"}</td>
                    <td className="num strong">{derived ? fmt(derived.runsPerOver, 2) : "—"}</td>
                    <td className="num strong">{derived ? fmt(derived.ballsPerWicket, 1) : "—"}</td>
                    <td>{cell ? <span className={`tag source-${cell.sourceLevel}`}>{cell.sourceLevel}</span> : "—"}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
