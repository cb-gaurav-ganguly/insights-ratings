import test from "node:test";
import assert from "node:assert/strict";
import { postAutoEvent, postScoringUpdate } from "../src/api.ts";

test("Refresh till now sends the match-complete autoevent envelope", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init: init! };
    return { ok: true } as Response;
  };
  try {
    const before = Date.now();
    await postAutoEvent(151338, new AbortController().signal);
    const after = Date.now();
    assert.equal(request?.url, "/cb/b/insights/v1/autoevent");
    assert.equal(request?.init.method, "POST");
    assert.equal((request?.init.headers as Record<string, string>)["Content-Type"], "application/json");
    const body = JSON.parse(String(request?.init.body));
    const { eventTime, ...payload } = body;
    assert.deepEqual(payload, {
      eventType: "match-complete",
      eventId: "match-complete:151338",
      matchId: 151338,
      data: { matchHeaders: { matchState: "inprogress" } },
    });
    assert.ok(eventTime >= before && eventTime <= after);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Setup PAR and Quality keeps its scoring-updates request", async () => {
  const originalFetch = globalThis.fetch;
  let request: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init: init! };
    return { ok: true } as Response;
  };
  try {
    await postScoringUpdate(151338, new AbortController().signal);
    assert.equal(request?.url, "/cb/b/matches/v1/scoring-updates");
    assert.equal(request?.init.method, "POST");
    assert.deepEqual(JSON.parse(String(request?.init.body)), {
      task: "match-header",
      matchId: "151338",
      inningsId: "0",
      overNbr: "0",
      state: "preview",
      timestamp: "0",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
