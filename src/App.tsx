import { useEffect, useState } from "react";
import { usePanelData } from "./usePanelData";
import Header from "./components/Header";
import Scorecard from "./components/Scorecard";
import ParTable from "./components/ParTable";
import Squads from "./components/Squads";

function readMatchId(): number | undefined {
  const value = Number(new URLSearchParams(window.location.search).get("matchId"));
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

export default function App() {
  const [matchId, setMatchId] = useState<number | undefined>(readMatchId);
  const [paused, setPaused] = useState(false);
  const data = usePanelData(matchId, paused);

  // Keep ?matchId= in the URL so a panel can be bookmarked or shared.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (matchId) url.searchParams.set("matchId", String(matchId));
    else url.searchParams.delete("matchId");
    window.history.replaceState(null, "", url);
  }, [matchId]);

  const info = data.info.data?.matchInfo;
  useEffect(() => {
    document.title = info
      ? `${info.team1.shortName} v ${info.team2.shortName} · Insights Ratings`
      : "Insights Ratings";
  }, [info]);

  return (
    <div className="app">
      <Header
        matchId={matchId}
        onMatchId={(next) => {
          setMatchId(next);
          setPaused(false);
        }}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        lastUpdated={data.lastUpdated}
        info={data.info.data}
        errors={[data.info.error, data.live.error, data.rating.error].filter(Boolean) as string[]}
      />
      {matchId === undefined ? (
        <div className="empty-state card">
          <div className="empty-state-icon" aria-hidden="true">🏏</div>
          <h2>Enter a match ID to start</h2>
          <p>The panel tracks live ball-by-ball score, PAR benchmark rates, and real-time player ratings.</p>
        </div>
      ) : data.loading ? (
        <div className="empty-state card" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p className="loading-text">Loading match {matchId}…</p>
        </div>
      ) : (
        <main className="grid" id="main-content">
          <Scorecard live={data.live} info={data.info.data} />
          <ParTable rating={data.rating} />
          <Squads
            info={data.info}
            rating={data.rating}
            activeAction={data.activeAction}
            actionError={data.actionError}
            onRefreshTillNow={data.refreshTillNow}
            onSetupParAndQuality={data.setupParAndQuality}
          />
        </main>
      )}
    </div>
  );
}
