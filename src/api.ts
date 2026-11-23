import type { InfoResponse, LivescoreResponse, RatingStateResponse } from "./types";

// In dev the Vite server proxies /cb to apiserver.cricbuzz.com; set VITE_API_BASE for other hosts.
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/cb";

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`${status} from ${url}`);
  }
}

async function getJSON<T>(path: string, signal: AbortSignal): Promise<T> {
  const url = `${BASE}${path}`;
  const response = await fetch(url, { signal, headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new HttpError(response.status, path);
  return (await response.json()) as T;
}

export const fetchInfo = (matchId: number, signal: AbortSignal) =>
  getJSON<InfoResponse>(`/m/mcenter/v1/${matchId}/info`, signal);

export const fetchLivescore = (matchId: number, signal: AbortSignal) =>
  getJSON<LivescoreResponse>(`/m/mcenter/v1/${matchId}/livescore`, signal);

// 404 means the match has no PAR or ratings yet, which is a normal state before match-setup.
export async function fetchRatingState(matchId: number, signal: AbortSignal): Promise<RatingStateResponse | null> {
  try {
    return await getJSON<RatingStateResponse>(`/b/insights/v1/player-ratings?matchId=${matchId}`, signal);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) return null;
    throw error;
  }
}
