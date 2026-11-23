export const REFRESH_MS = 5000;

export interface PollerOptions {
  fetchData: () => Promise<void>;
  isHidden: () => boolean;
  refreshMs?: number;
}

export function createPoller(options: PollerOptions) {
  const refreshMs = options.refreshMs ?? REFRESH_MS;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;

  const tick = async () => {
    if (inFlight || !active) return;
    if (options.isHidden()) {
      timer = setTimeout(tick, refreshMs);
      return;
    }
    inFlight = true;
    try {
      await options.fetchData();
    } finally {
      inFlight = false;
      if (active) {
        timer = setTimeout(tick, refreshMs);
      }
    }
  };

  const onVisible = () => {
    // Trigger immediate tick when returning to tab, only if no poll is already in flight.
    if (!options.isHidden() && !inFlight && active) {
      clearTimeout(timer);
      tick();
    }
  };

  const stop = () => {
    active = false;
    clearTimeout(timer);
  };

  return {
    tick,
    onVisible,
    stop,
  };
}
