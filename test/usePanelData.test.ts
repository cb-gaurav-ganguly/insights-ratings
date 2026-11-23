import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// Minimal DOM mock for React 19 createRoot in Node.js test environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as unknown as { HTMLIFrameElement: unknown }).HTMLIFrameElement = class {};

const listeners = new Map<string, Set<(event?: unknown) => void>>();
const mockDocument = {
  nodeType: 9,
  activeElement: null,
  hidden: false,
  createElement: (tag: string) => ({
    nodeType: 1,
    tagName: tag.toUpperCase(),
    childNodes: [] as unknown[],
    style: {},
    setAttribute: () => {},
    removeAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: function <T>(c: T): T {
      (this.childNodes as T[]).push(c);
      return c;
    },
    removeChild: function <T>(c: T): T {
      this.childNodes = (this.childNodes as T[]).filter((x) => x !== c);
      return c;
    },
    insertBefore: function <T>(c: T): T {
      (this.childNodes as T[]).push(c);
      return c;
    },
  }),
  createTextNode: (text: string) => ({ nodeType: 3, nodeValue: text, parentNode: null }),
  addEventListener: (type: string, fn: (event?: unknown) => void) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)?.add(fn);
  },
  removeEventListener: (type: string, fn: (event?: unknown) => void) => {
    listeners.get(type)?.delete(fn);
  },
  defaultView: globalThis,
};

(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { document: unknown }).document = mockDocument;

// Mock API responses controllable per test
type FetchHandler = (id: number) => {
  info: unknown;
  live: unknown;
  rating: unknown;
};

const defaultHandler: FetchHandler = (id: number) => ({
  info: { matchInfo: { id, team1: { shortName: "T1" }, team2: { shortName: "T2" } } },
  live: { matchScoreDetails: { customStatus: `Live-${id}` } },
  rating: { matchId: id, ratings: [] },
});

let currentHandler: FetchHandler = defaultHandler;

let fetchDelayMs = 0;

(globalThis as unknown as { __mockApiFetch: (endpoint: string, id: number, signal?: AbortSignal) => Promise<unknown> }).__mockApiFetch =
  async (endpoint: string, id: number, signal?: AbortSignal) => {
    if (signal?.aborted) {
      throw new DOMException("This operation was aborted", "AbortError");
    }
    if (fetchDelayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onAbort = () => {
          clearTimeout(timer);
          reject(new DOMException("This operation was aborted", "AbortError"));
        };
        if (signal) {
          signal.addEventListener("abort", onAbort, { once: true });
        }
        timer = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        }, fetchDelayMs);
      });
    }
    const data = currentHandler(id);
    if (endpoint === "info") return data.info;
    if (endpoint === "live") return data.live;
    return data.rating;
  };

const mockApiUrl =
  "data:text/javascript," +
  encodeURIComponent(`
  export const fetchInfo = (id, signal) => globalThis.__mockApiFetch("info", id, signal);
  export const fetchLivescore = (id, signal) => globalThis.__mockApiFetch("live", id, signal);
  export const fetchRatingState = (id, signal) => globalThis.__mockApiFetch("rating", id, signal);
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "./api" || specifier.endsWith("/api")) {
      return nextResolve(mockApiUrl, context);
    }
    try {
      return nextResolve(specifier, context);
    } catch (err: unknown) {
      const error = err as { code?: string };
      if (error.code === "ERR_MODULE_NOT_FOUND" && (specifier.startsWith("./") || specifier.startsWith("../"))) {
        const targetPath = fileURLToPath(new URL(specifier, context.parentURL));
        if (fs.existsSync(targetPath + ".ts")) {
          return nextResolve(pathToFileURL(targetPath + ".ts").href, context);
        }
      }
      throw err;
    }
  },
});

// Import React DOM client, React and usePanelData after hook registration
const { createRoot } = await import("react-dom/client");
const { act, createElement } = await import("react");
const { usePanelData } = await import("../src/usePanelData.ts");

interface HarnessProps {
  matchId: number | undefined;
  paused: boolean;
}

function createHarness(t: TestContext) {
  let latestData: ReturnType<typeof usePanelData> | undefined;
  const history: Array<ReturnType<typeof usePanelData>> = [];

  function TestComponent(props: HarnessProps) {
    latestData = usePanelData(props.matchId, props.paused);
    history.push({ ...latestData });
    return null;
  }

  const container = mockDocument.createElement("div");
  (container as unknown as { ownerDocument: unknown }).ownerDocument = mockDocument;
  const root = createRoot(container as unknown as HTMLElement);

  let unmounted = false;
  const unmount = async () => {
    if (unmounted) return;
    unmounted = true;
    await act(async () => {
      root.unmount();
    });
  };

  t.after(async () => {
    await unmount();
    currentHandler = defaultHandler;
    fetchDelayMs = 0;
  });

  const update = async (props: HarnessProps) => {
    await act(async () => {
      root.render(createElement(TestComponent, props));
    });
  };

  const wait = async (ms: number = 20) => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });
  };

  return {
    update,
    wait,
    unmount,
    get latest() {
      return latestData!;
    },
    get history() {
      return history;
    },
  };
}

test("usePanelData initial load starts loading and populates all sources", async (t) => {
  fetchDelayMs = 0;
  const harness = createHarness(t);

  await harness.update({ matchId: 101, paused: false });
  // Initial state is loading
  assert.equal(harness.history[0].loading, true, "Initial render is loading");

  await harness.wait(10);
  assert.equal(harness.latest.loading, false, "Loading completes after fetch settles");
  assert.equal((harness.latest.info.data as { matchInfo: { id: number } })?.matchInfo.id, 101);
  assert.equal((harness.latest.live.data as { matchScoreDetails: { customStatus: string } })?.matchScoreDetails.customStatus, "Live-101");
  assert.ok(typeof harness.latest.lastUpdated === "number", "lastUpdated is recorded as a timestamp");
});

test("Pause keeps displayed last good data and lastUpdated, without resetting to empty", async (t) => {
  fetchDelayMs = 0;
  const harness = createHarness(t);

  // Load match 102
  await harness.update({ matchId: 102, paused: false });
  await harness.wait(10);

  const prePauseInfo = harness.latest.info.data;
  const prePauseLive = harness.latest.live.data;
  const prePauseRating = harness.latest.rating.data;
  const prePauseUpdated = harness.latest.lastUpdated;

  assert.ok(prePauseInfo !== undefined, "Pre-pause info must exist");
  assert.ok(prePauseUpdated !== undefined, "Pre-pause lastUpdated must exist");

  // Toggle pause to true
  await harness.update({ matchId: 102, paused: true });
  await harness.wait(10);

  // Assert all data and lastUpdated are preserved, not reset!
  assert.deepEqual(harness.latest.info.data, prePauseInfo, "Pause MUST NOT blank info data");
  assert.deepEqual(harness.latest.live.data, prePauseLive, "Pause MUST NOT blank live data");
  assert.deepEqual(harness.latest.rating.data, prePauseRating, "Pause MUST NOT blank rating data");
  assert.equal(harness.latest.lastUpdated, prePauseUpdated, "Pause MUST NOT wipe lastUpdated");
  assert.equal(harness.latest.loading, false, "Pause loading state is false");
});

test("Resume retains displayed data until background refresh completes", async (t) => {
  fetchDelayMs = 50; // Add network latency so we can observe state during in-flight resume
  const harness = createHarness(t);

  // Load match 103 and wait for initial fetch
  await harness.update({ matchId: 103, paused: false });
  await harness.wait(70);

  const initialUpdated = harness.latest.lastUpdated;
  assert.ok(initialUpdated !== undefined, "Initial data is loaded");

  // Pause
  await harness.update({ matchId: 103, paused: true });
  await harness.wait(10);

  // Update backend data for subsequent fetch
  currentHandler = (id: number) => ({
    info: { matchInfo: { id, team1: { shortName: "UPDATED" }, team2: { shortName: "T2" } } },
    live: { matchScoreDetails: { customStatus: "Live-Updated" } },
    rating: { matchId: id, ratings: [{ player: "Star" }] },
  });

  // Resume polling
  await harness.update({ matchId: 103, paused: false });

  // Immediately upon resume, displayed data and lastUpdated must still be retained!
  assert.equal(harness.latest.loading, false, "Resume MUST retain loading: false when valid data is displayed");
  assert.equal((harness.latest.info.data as { matchInfo: { team1: { shortName: string } } })?.matchInfo.team1.shortName, "T1", "Must keep prior data while refresh is in flight");
  assert.equal(harness.latest.lastUpdated, initialUpdated, "lastUpdated retains prior value until refresh");

  // Wait for background refresh to finish
  await harness.wait(70);

  assert.equal(harness.latest.loading, false);
  assert.equal((harness.latest.info.data as { matchInfo: { team1: { shortName: string } } })?.matchInfo.team1.shortName, "UPDATED", "Data updates once refresh settles");
  assert.ok(harness.latest.lastUpdated! > initialUpdated!, "lastUpdated updates once refresh settles");
});

test("Pause during initial loading clears loading state without stuck spinner, and resumes into loading", async (t) => {
  fetchDelayMs = 80;
  const harness = createHarness(t);

  // Mount match 104 with in-flight fetch
  await harness.update({ matchId: 104, paused: false });
  assert.equal(harness.latest.loading, true, "Initial fetch is in progress");

  // Pause BEFORE fetch completes
  await harness.update({ matchId: 104, paused: true });
  assert.equal(harness.latest.loading, false, "Pausing clears loading so spinner does not hang forever");
  assert.equal(harness.latest.lastUpdated, undefined, "No data was ever received");

  // Resume when no data was ever loaded yet
  await harness.update({ matchId: 104, paused: false });
  assert.equal(harness.latest.loading, true, "Resuming when never loaded transitions back to loading");

  // Wait for fetch to complete
  await harness.wait(100);
  assert.equal(harness.latest.loading, false, "Loading finishes after fetch resolves");
  assert.ok(typeof harness.latest.lastUpdated === "number", "Data has now loaded");
});

test("Reset occurs ONLY when matchId changes", async (t) => {
  fetchDelayMs = 0;
  currentHandler = (id: number) => ({
    info: { matchInfo: { id, team1: { shortName: `Match-${id}` } } },
    live: { matchScoreDetails: { customStatus: `Status-${id}` } },
    rating: { matchId: id, ratings: [] },
  });
  const harness = createHarness(t);

  // Load match 105
  await harness.update({ matchId: 105, paused: false });
  await harness.wait(10);
  assert.equal((harness.latest.info.data as { matchInfo: { team1: { shortName: string } } })?.matchInfo.team1.shortName, "Match-105");

  // Switch to match 106
  await harness.update({ matchId: 106, paused: false });
  // The reset effect ran because matchId changed
  assert.equal((harness.latest.info.data as { matchInfo?: { team1?: { shortName: string } } })?.matchInfo?.team1?.shortName, "Match-106");

  // Switch to matchId = undefined
  await harness.update({ matchId: undefined, paused: false });
  await harness.wait(10);
  assert.equal(harness.latest.info.data, undefined, "info data reset to undefined");
  assert.equal(harness.latest.live.data, undefined, "live data reset to undefined");
  assert.equal(harness.latest.rating.data, undefined, "rating data reset to undefined");
  assert.equal(harness.latest.lastUpdated, undefined, "lastUpdated reset to undefined");
  assert.equal(harness.latest.loading, false, "loading is false when matchId is undefined");
});
