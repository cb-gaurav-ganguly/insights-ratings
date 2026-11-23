import { useEffect, useRef, useState } from "react";
import { fetchInfo, fetchLivescore, fetchRatingState } from "./api";
import { createPoller, REFRESH_MS } from "./poller";
export { REFRESH_MS } from "./poller";
import type { InfoResponse, LivescoreResponse, RatingStateResponse } from "./types";

export interface Source<T> {
  data: T | undefined;
  error: string | undefined;
}

export interface PanelData {
  info: Source<InfoResponse>;
  live: Source<LivescoreResponse>;
  rating: Source<RatingStateResponse | null>;
  lastUpdated: number | undefined;
  loading: boolean;
}

const empty = <T>(): Source<T> => ({ data: undefined, error: undefined });

function settle<T>(previous: Source<T>, result: PromiseSettledResult<T>): Source<T> {
  if (result.status === "fulfilled") return { data: result.value, error: undefined };
  const reason = result.reason as Error;
  return { data: previous.data, error: reason?.message ?? "request failed" };
}

export function usePanelData(matchId: number | undefined, paused: boolean): PanelData {
  const [state, setState] = useState<PanelData>(() => ({
    info: empty(),
    live: empty(),
    rating: empty(),
    lastUpdated: undefined,
    loading: matchId !== undefined && !paused,
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const activeMatchIdRef = useRef(matchId);
  activeMatchIdRef.current = matchId;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    setState({
      info: empty(),
      live: empty(),
      rating: empty(),
      lastUpdated: undefined,
      loading: matchId !== undefined && !pausedRef.current,
    });
  }, [matchId]);

  useEffect(() => {
    if (paused) {
      setState((prev) => (prev.loading ? { ...prev, loading: false } : prev));
    } else if (matchId !== undefined) {
      setState((prev) => (prev.lastUpdated === undefined && !prev.loading ? { ...prev, loading: true } : prev));
    }
  }, [paused, matchId]);

  useEffect(() => {
    if (matchId === undefined || paused) return;
    const controller = new AbortController();

    const poller = createPoller({
      fetchData: async () => {
        const [info, live, rating] = await Promise.allSettled([
          fetchInfo(matchId, controller.signal),
          fetchLivescore(matchId, controller.signal),
          fetchRatingState(matchId, controller.signal),
        ]);
        if (controller.signal.aborted || activeMatchIdRef.current !== matchId) return;
        const previous = stateRef.current;
        setState({
          info: settle(previous.info, info),
          live: settle(previous.live, live),
          rating: settle(previous.rating, rating),
          lastUpdated: Date.now(),
          loading: false,
        });
      },
      isHidden: () => document.hidden,
      refreshMs: REFRESH_MS,
    });

    poller.tick();
    const onVisible = () => poller.onVisible();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      controller.abort();
      poller.stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [matchId, paused]);

  return state;
}
