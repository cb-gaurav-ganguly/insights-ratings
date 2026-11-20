import { useEffect, useRef, useState } from "react";
import { fetchInfo, fetchLivescore, fetchRatingState } from "./api";
import type { InfoResponse, LivescoreResponse, RatingStateResponse } from "./types";

export const REFRESH_MS = 5000;

export interface Source<T> {
  data: T | undefined;
  error: string | undefined;
}

export interface PanelData {
  info: Source<InfoResponse>;
  live: Source<LivescoreResponse>;
  // null data means the ratings endpoint answered 404 (nothing prepared yet).
  rating: Source<RatingStateResponse | null>;
  lastUpdated: number | undefined;
  loading: boolean;
}

const empty = <T,>(): Source<T> => ({ data: undefined, error: undefined });

// Keeps the last good payload per source, so one failing endpoint does not blank the panel.
function settle<T>(previous: Source<T>, result: PromiseSettledResult<T>): Source<T> {
  if (result.status === "fulfilled") return { data: result.value, error: undefined };
  const reason = result.reason as Error;
  return { data: previous.data, error: reason?.message ?? "request failed" };
}

export function usePanelData(matchId: number | undefined, paused: boolean): PanelData {
  const [state, setState] = useState<PanelData>({
    info: empty(), live: empty(), rating: empty(), lastUpdated: undefined, loading: false,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState({ info: empty(), live: empty(), rating: empty(), lastUpdated: undefined, loading: matchId !== undefined });
  }, [matchId]);

  useEffect(() => {
    if (matchId === undefined || paused) return;
    const controller = new AbortController();
    let timer: number | undefined;

    // Each poll waits for the previous one to finish, so slow responses never overlap.
    const tick = async () => {
      if (document.hidden) {
        timer = window.setTimeout(tick, REFRESH_MS);
        return;
      }
      const [info, live, rating] = await Promise.allSettled([
        fetchInfo(matchId, controller.signal),
        fetchLivescore(matchId, controller.signal),
        fetchRatingState(matchId, controller.signal),
      ]);
      if (controller.signal.aborted) return;
      const previous = stateRef.current;
      setState({
        info: settle(previous.info, info),
        live: settle(previous.live, live),
        rating: settle(previous.rating, rating),
        lastUpdated: Date.now(),
        loading: false,
      });
      timer = window.setTimeout(tick, REFRESH_MS);
    };

    tick();
    const onVisible = () => {
      if (!document.hidden) {
        window.clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [matchId, paused]);

  return state;
}
