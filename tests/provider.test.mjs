import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetry } from "../supabase/functions/quiz-ai/provider.mjs";

test("temporary Gemini failures retry with backoff and recover", async () => {
  const statuses = [503, 503, 200], delays = [];
  const response = await fetchWithRetry("https://example.test", {}, {
    fetcher: async () => new Response(null, { status: statuses.shift() }),
    sleep: async ms => { delays.push(ms); }
  });
  assert.equal(response.status, 200);
  assert.deepEqual(delays, [1000, 2000]);
});
test("retries stop after three attempts; provider quotas and auth errors are not retried", async () => {
  for (const status of [503, 429, 403]) {
    let calls = 0;
    const response = await fetchWithRetry("https://example.test", {}, {
      fetcher: async () => { calls++; return new Response(null, { status }); }, sleep: async () => {}
    });
    assert.equal(response.status, status);
    assert.equal(calls, status === 503 ? 3 : 1);
  }
});
