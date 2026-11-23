import test from "node:test";
import assert from "node:assert/strict";
import { derivePAR } from "../src/par.ts";
import { parseBall } from "../src/scorecardUtils.ts";
import { createPoller } from "../src/poller.ts";
import { FLASH_MS, pruneExpiredFlashes, calculateFlashDelay } from "../src/flashUtils.ts";

test("derivePAR correctly computes strikeRate, runsPerOver, and ballsPerWicket for finite values", () => {
  const cell = {
    innings: 1,
    phase: "powerplay",
    batRuns: 45,
    ballsFaced: 36,
    chargedRuns: 50,
    legalBalls: 36,
    dismissals: 1,
    sourceLevel: "ground",
  };
  const derived = derivePAR(cell);
  assert.equal(derived.strikeRate, (100 * 45) / 36);
  assert.equal(derived.runsPerOver, (6 * 50) / 36);
  assert.equal(derived.ballsPerWicket, 36 / 1);
});

test("derivePAR handles zero denominators safely by returning null", () => {
  const zeroCell = {
    innings: 1,
    phase: "powerplay",
    batRuns: 0,
    ballsFaced: 0,
    chargedRuns: 0,
    legalBalls: 0,
    dismissals: 0,
    sourceLevel: "format",
  };
  const derived = derivePAR(zeroCell);
  assert.equal(derived.strikeRate, null);
  assert.equal(derived.runsPerOver, null);
  assert.equal(derived.ballsPerWicket, null);
});

test("derivePAR guards against NaN, Infinity, -Infinity, and non-numeric inputs", () => {
  // NaN inputs
  const nanCell = {
    innings: 1,
    phase: "middle",
    batRuns: Number.NaN,
    ballsFaced: 30,
    chargedRuns: Number.NaN,
    legalBalls: 30,
    dismissals: Number.NaN,
    sourceLevel: "ground",
  };
  const nanDerived = derivePAR(nanCell);
  assert.equal(nanDerived.strikeRate, null);
  assert.equal(nanDerived.runsPerOver, null);
  assert.equal(nanDerived.ballsPerWicket, null);

  // Infinity inputs
  const infCell = {
    innings: 1,
    phase: "death",
    batRuns: Number.POSITIVE_INFINITY,
    ballsFaced: 20,
    chargedRuns: Number.NEGATIVE_INFINITY,
    legalBalls: 20,
    dismissals: Number.POSITIVE_INFINITY,
    sourceLevel: "format",
  };
  const infDerived = derivePAR(infCell);
  assert.equal(infDerived.strikeRate, null);
  assert.equal(infDerived.runsPerOver, null);
  assert.equal(infDerived.ballsPerWicket, null);

  // Infinite balls / denominators
  const infDenomCell = {
    innings: 1,
    phase: "powerplay",
    batRuns: 30,
    ballsFaced: Number.POSITIVE_INFINITY,
    chargedRuns: 25,
    legalBalls: Number.POSITIVE_INFINITY,
    dismissals: 1,
    sourceLevel: "ground",
  };
  const infDenomDerived = derivePAR(infDenomCell);
  assert.equal(infDenomDerived.strikeRate, null);
  assert.equal(infDenomDerived.runsPerOver, null);
  assert.equal(infDenomDerived.ballsPerWicket, null);

  // Non-number / undefined types
  const invalidTypeCell = {
    innings: 1,
    phase: "middle",
    batRuns: "50" as unknown as number,
    ballsFaced: 20,
    chargedRuns: null as unknown as number,
    legalBalls: 20,
    dismissals: undefined as unknown as number,
    sourceLevel: "ground",
  };
  const invalidTypeDerived = derivePAR(invalidTypeCell);
  assert.equal(invalidTypeDerived.strikeRate, null);
  assert.equal(invalidTypeDerived.runsPerOver, null);
  assert.equal(invalidTypeDerived.ballsPerWicket, null);
});

test("parseBall correctly classifies boundaries, extras, wickets, dots, and unknown tokens", () => {
  // Batting boundaries: exact 4 and 6
  assert.equal(parseBall("4").kind, "four");
  assert.equal(parseBall("6").kind, "six");

  // Extras: WD, NB, LB, B (byes and leg byes are extras, NOT batting boundaries!)
  assert.equal(parseBall("4b").kind, "extra");
  assert.equal(parseBall("4B").kind, "extra");
  assert.equal(parseBall("4lb").kind, "extra");
  assert.equal(parseBall("6lb").kind, "extra");
  assert.equal(parseBall("1b").kind, "extra");
  assert.equal(parseBall("1lb").kind, "extra");
  assert.equal(parseBall("b").kind, "extra");
  assert.equal(parseBall("lb").kind, "extra");
  assert.equal(parseBall("Wd").kind, "extra");
  assert.equal(parseBall("1Wd").kind, "extra");
  assert.equal(parseBall("wd").kind, "extra");
  assert.equal(parseBall("Nb").kind, "extra");
  assert.equal(parseBall("1nb").kind, "extra");
  assert.equal(parseBall("nb").kind, "extra");

  // Pure wickets and run+wicket
  assert.equal(parseBall("W").kind, "w");
  assert.equal(parseBall("w").kind, "w");
  assert.equal(parseBall("1W").kind, "w");
  assert.equal(parseBall("2W").kind, "w");

  // Dot balls
  assert.equal(parseBall("0").kind, "dot");
  assert.equal(parseBall(".").kind, "dot");

  // Over separator
  assert.equal(parseBall("|").kind, "separator");

  // Normal runs
  assert.equal(parseBall("1").kind, "normal");
  assert.equal(parseBall("2").kind, "normal");
  assert.equal(parseBall("3").kind, "normal");

  // Multi-digit and unknown tokens: must NOT invent four/six/extra/w classifications
  assert.equal(parseBall("40").kind, "normal");
  assert.equal(parseBall("60").kind, "normal");
  assert.equal(parseBall("swing").kind, "normal");
  assert.equal(parseBall("white").kind, "normal");
  assert.equal(parseBall("bowl").kind, "normal");
  assert.equal(parseBall("wide_ball").kind, "normal");
  assert.equal(parseBall("unknown").kind, "normal");
});

test("createPoller prevents overlapping visibility requests while a poll is in flight", async () => {
  let fetchCount = 0;
  let resolveCurrentFetch: (() => void) | null = null;
  let isHidden = false;

  const poller = createPoller({
    fetchData: () => {
      fetchCount += 1;
      return new Promise<void>((resolve) => {
        resolveCurrentFetch = resolve;
      });
    },
    isHidden: () => isHidden,
    refreshMs: 5000,
  });

  // Start initial tick
  const tickPromise = poller.tick();
  assert.equal(fetchCount, 1, "Initial fetch started");

  // Visibility change fires while poll is in-flight (e.g. user switches tabs back and forth)
  poller.onVisible();
  poller.onVisible();
  assert.equal(fetchCount, 1, "Visibility change must NOT trigger overlapping fetch while in flight");

  // Direct concurrent tick attempt must also return early
  poller.tick();
  assert.equal(fetchCount, 1, "Concurrent tick must return early without starting a new request");

  // Now resolve the in-flight fetch
  resolveCurrentFetch?.();
  await tickPromise;

  // Now that the prior poll finished, returning to tab triggers an immediate poll
  const nextTickPromise = poller.onVisible();
  assert.equal(fetchCount, 2, "onVisible triggers immediate poll when no request is in flight");

  resolveCurrentFetch?.();
  await nextTickPromise;
  poller.stop();
});

test("createPoller does not trigger onVisible when tab is hidden", async () => {
  let fetchCount = 0;
  const poller = createPoller({
    fetchData: async () => {
      fetchCount += 1;
    },
    isHidden: () => true, // Tab remains hidden
    refreshMs: 5000,
  });

  poller.onVisible();
  assert.equal(fetchCount, 0, "No fetch triggered when hidden");
  poller.stop();
});

test("pruneExpiredFlashes retains recent flashes and prunes expired ones", () => {
  const baseTime = 10_000;
  const initialFlashes: Record<string, number> = {
    player1: baseTime,       // at 10,000
    player2: baseTime + 2000, // at 12,000
  };

  // At 13,000: player1 elapsed 3,000 (< 4,000), player2 elapsed 1,000 (< 4,000) -> neither expired
  const res1 = pruneExpiredFlashes(initialFlashes, baseTime + 3000, FLASH_MS);
  assert.equal(res1.didChange, false);
  assert.equal(Object.keys(res1.next).length, 2);

  // At 14,001: player1 elapsed 4,001 (>= 4,000) -> pruned! player2 elapsed 2,001 -> kept
  const res2 = pruneExpiredFlashes(initialFlashes, baseTime + 4001, FLASH_MS);
  assert.equal(res2.didChange, true);
  assert.deepEqual(res2.next, { player2: baseTime + 2000 });

  // At 16,001: player2 elapsed 4,001 -> also pruned
  const res3 = pruneExpiredFlashes(res2.next, baseTime + 6001, FLASH_MS);
  assert.equal(res3.didChange, true);
  assert.deepEqual(res3.next, {});
});

test("calculateFlashDelay targets oldest unexpired flash with 50ms floor", () => {
  const baseTime = 10_000;
  const flashes: Record<string, number> = {
    playerA: baseTime,       // oldest
    playerB: baseTime + 1500,
  };

  // At baseTime + 1000: oldest has 3000ms left
  const delay1 = calculateFlashDelay(flashes, baseTime + 1000, FLASH_MS);
  assert.equal(delay1, 3000);

  // At baseTime + 3980: oldest has 20ms left -> floor of 50ms applied
  const delay2 = calculateFlashDelay(flashes, baseTime + 3980, FLASH_MS);
  assert.equal(delay2, 50);

  // Empty record returns FLASH_MS
  assert.equal(calculateFlashDelay({}, baseTime, FLASH_MS), FLASH_MS);
});
