import { useEffect, useRef, useState } from "react";
import { fetchInfo, fetchLivescore, fetchRatingState, postScoringUpdate } from "./api";
import { createPoller, REFRESH_MS } from "./poller";
export { REFRESH_MS } from "./poller";
import type { InfoResponse, LivescoreResponse, RatingStateResponse } from "./types";

export interface Source<T> {
  data: T | undefined;
  error: string | undefined;
}

interface PanelState {
  info: Source<InfoResponse>;
  live: Source<LivescoreResponse>;
  rating: Source<RatingStateResponse | null>;
  lastUpdated: number | undefined;
  loading: boolean;
}

export interface PanelData extends PanelState {
  activeAction: "postscore" | "match-header" | null;
  actionError: string | undefined;
  refreshTillNow: () => Promise<void>;
  setupParAndQuality: () => Promise<void>;
}

const empty = <T>(): Source<T> => ({ data: undefined, error: undefined });

function settle<T>(previous: Source<T>, result: PromiseSettledResult<T>): Source<T> {
  if (result.status === "fulfilled") return { data: result.value, error: undefined };
  const reason = result.reason as Error;
  return { data: previous.data, error: reason?.message ?? "request failed" };
}

export function usePanelData(matchId: number | undefined, paused: boolean): PanelData {
  const [activeAction, setActiveAction] = useState<"postscore" | "match-header" | null>(null);
  const [actionError, setActionError] = useState<string>();
  const refreshController = useRef<AbortController | null>(null);
  const ratingEpoch = useRef(0);
  const [state, setState] = useState<PanelState>(() => ({
    info: empty(),
    live: empty(),
    rating: empty(),
    lastUpdated: undefined,
    loading: matchId !== undefined && !paused,
  }));
  const activeMatchIdRef = useRef(matchId);
  activeMatchIdRef.current = matchId;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    refreshController.current?.abort();
    refreshController.current = null;
    setActiveAction(null);
    setActionError(undefined);
    setState({
      info: empty(),
      live: empty(),
      rating: empty(),
      lastUpdated: undefined,
      loading: matchId !== undefined && !pausedRef.current,
    });
  }, [matchId]);

  useEffect(() => () => refreshController.current?.abort(), []);

  const runScoringUpdate = async (task: "postscore" | "match-header") => {
    const id = activeMatchIdRef.current;
    if (id === undefined || refreshController.current) return;
    const controller = new AbortController();
    refreshController.current = controller;
    ratingEpoch.current++;
    setActiveAction(task);
    setActionError(undefined);
    try {
      await postScoringUpdate(id, controller.signal, task);
      const rating = await fetchRatingState(id, controller.signal);
      if (!controller.signal.aborted && activeMatchIdRef.current === id) {
        setState((previous) => ({ ...previous, rating: { data: rating, error: undefined } }));
      }
    } catch (error) {
      if (!controller.signal.aborted && activeMatchIdRef.current === id) {
        const label = task === "postscore" ? "Refresh till now" : "Setup PAR and Quality";
        setActionError(`${label} failed: ${error instanceof Error ? error.message : "Request failed"}`);
      }
    } finally {
      if (refreshController.current === controller) {
        ratingEpoch.current++;
        refreshController.current = null;
        setActiveAction(null);
      }
    }
  };

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
        const epoch = ratingEpoch.current;
        const [info, live, rating] = await Promise.allSettled([
          fetchInfo(matchId, controller.signal),
          fetchLivescore(matchId, controller.signal),
          fetchRatingState(matchId, controller.signal),
        ]);
        if (controller.signal.aborted || activeMatchIdRef.current !== matchId) return;
        setState((previous) => ({
          info: settle(previous.info, info),
          live: settle(previous.live, live),
          rating: epoch === ratingEpoch.current ? settle(previous.rating, rating) : previous.rating,
          lastUpdated: Date.now(),
          loading: false,
        }));
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

  return {
    ...state,
    activeAction,
    actionError,
    refreshTillNow: () => runScoringUpdate("postscore"),
    setupParAndQuality: () => runScoringUpdate("match-header"),
  };
}
