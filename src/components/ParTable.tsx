import { derivePAR, PHASES } from "../par";
import type { RatingStateResponse } from "../types";
import type { Source } from "../usePanelData";
import { SourceError } from "./SourceError";

const fmt = (n: number | null, digits: number) => (n === null ? "—" : n.toFixed(digits));
const formatDateTime = (iso?: string) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  } catch {
    return "—";
  }
};

export default function ParTable({ rating }: { rating: Source<RatingStateResponse | null> }) {
  const par = rating.data?.par;
  return (
    <section className="card par" aria-labelledby="par-heading">
      <div className="card-head">
        <h2 id="par-heading">PAR table</h2>
        {par && <span className="muted small">Prepared {formatDateTime(par.preparedAt)}</span>}
      </div>
      <SourceError error={rating.error} hasData={Boolean(rating.data)} />
      {!par ? (
        <div className="empty-substate">
          <p className="muted">No PAR snapshot for this match yet. It is prepared on match-setup.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table" aria-label="PAR benchmarks by phase">
            <thead>
              <tr>
                <th scope="col">Inn</th>
                <th scope="col">Phase</th>
                <th scope="col" className="num" title="Par batting strike rate: 100 × bat runs ÷ balls faced">Strike rate</th>
                <th scope="col" className="num" title="Par runs per over: 6 × charged runs ÷ legal balls">Runs / over</th>
                <th scope="col" className="num" title="Balls faced ÷ dismissals">Balls / wkt</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2].flatMap((innings) =>
                PHASES.map((phase, index) => {
                  const cells = par.cells ?? [];
                  const cell = cells.find(
                    (c) => c.innings === innings && c.phase?.toLowerCase() === phase.toLowerCase()
                  );
                  const derived = cell ? derivePAR(cell) : undefined;
                  const source = cell?.sourceLevel?.toLowerCase() ?? "";
                  return (
                    <tr key={`${innings}-${phase}`} className={index === 0 ? "group-start" : undefined}>
                      <td className="inn-col">{index === 0 ? <span className="inn-badge">Inn {innings}</span> : ""}</td>
                      <td className="phase-cell"><span className={`phase-tag phase-${phase}`}>{phase}</span></td>
                      <td className="num strong">{derived ? fmt(derived.strikeRate, 1) : "—"}</td>
                      <td className="num strong">{derived ? fmt(derived.runsPerOver, 2) : "—"}</td>
                      <td className="num strong">{derived ? fmt(derived.ballsPerWicket, 1) : "—"}</td>
                      <td>
                        {cell ? (
                          <span className={`tag source-${source}`}>{cell.sourceLevel}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
