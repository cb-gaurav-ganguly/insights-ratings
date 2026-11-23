# insights-ratings

A live panel for one match. Every 5 seconds it shows:

- **Mini scorecard**: innings scores, status, current batters and bowlers, run rates, recent balls and latest commentary. Source: `GET /m/mcenter/v1/{matchId}/livescore`.
- **PAR table**: the six PAR cells (innings × powerplay/middle/death), showing par strike rate, runs per over, balls per wicket and source level. Source: insights-emerald `GET /b/insights/v1/player-ratings?matchId={matchId}`.
- **Playing XI and ratings**: both squads from `GET /m/mcenter/v1/{matchId}/info`, joined with each player's rating, components, batting quality and `updatedByEventId`. A row briefly highlights when its `updatedByEventId` changes.

## Run

```sh
npm install
npm run dev
# open http://localhost:5173/?matchId=161212
```

The dev server proxies `/cb/*` to `https://apiserver.cricbuzz.com`, because the API does not allow browser calls from localhost. For a deployed build, set `VITE_API_BASE` to a base URL that serves the same paths and allows CORS (or put the build behind the same proxy):

```sh
VITE_API_BASE=https://example.internal npm run build
```

## Behaviour

- Polls start only after the previous refresh finishes, and pause while the tab is hidden. **Pause** stops polling.
- If one endpoint fails, the panel keeps that endpoint's last good data, shows a warning, and keeps polling.
- A `404` from the ratings endpoint means match-setup has not prepared PAR yet. The panel shows this as an empty state.
- PAR rates are derived the same way as `matchperformance.DerivePAR` in insights-emerald.
- **Batting quality** is shown when the ratings response includes `battingQuality` for a player. insights-emerald does not return it yet, so the column shows `—`.
