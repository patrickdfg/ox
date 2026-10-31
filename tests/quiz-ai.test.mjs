import { test } from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "../supabase/functions/quiz-ai/core.mjs";

const origin = "https://patrickdfg.github.io";
const source = "컴퓨터는 정보를 0과 1로 표현합니다. 이진수는 두 개의 숫자를 사용합니다.";
const question = { type: "ox", q: "컴퓨터는 0과 1을 사용한다.", options: ["O", "X"], answer: 0, exp: "원고에서 0과 1을 사용한다고 설명합니다." };
const request = (body, overrides = {}) => new Request("https://example.test", { method: "POST", headers: { origin, authorization: "Bearer valid" }, body: JSON.stringify(body), ...overrides });
const valid = { source, count: 1, type: "ox" };
const handler = overrides => createHandler({ verify: async token => token === "valid" ? "user-a" : null, reserve: async () => ({ allowed: true }), generate: async () => [question], ...overrides });

test("로그인과 허용 출처를 확인한다", async () => {
  assert.equal((await handler()(request(valid, { headers: { origin } }))).status, 401);
  assert.equal((await handler()(request(valid, { headers: { origin: "https://other.example", authorization: "Bearer valid" } }))).status, 403);
  assert.equal((await handler()(request(valid, { headers: { origin, authorization: "Bearer invalid" } }))).status, 401);
});
test("입력이 유효할 때만 사용량을 예약한다", async () => {
  let reservations = 0;
  const run = handler({ reserve: async () => { reservations++; return { allowed: true }; } });
  assert.equal((await run(request({ ...valid, source: "짧음" }))).status, 400);
  assert.equal((await run(request({ ...valid, count: 21 }))).status, 400);
  assert.equal(reservations, 0);
  const result = await run(request(valid));
  assert.equal(result.status, 200);
  assert.deepEqual((await result.json()).questions, [{ ...question, time: 20 }]);
  assert.equal(reservations, 1);
});
test("호출 제한은 AI 호출 전에 적용된다", async () => {
  let generated = 0;
  const run = handler({ reserve: async () => ({ allowed: false, reason: "daily" }), generate: async () => { generated++; return [question]; } });
  assert.equal((await run(request(valid))).status, 429);
  assert.equal(generated, 0);
});
test("유형·보기·정답이 잘못된 AI 결과는 표시하지 않는다", async () => {
  const cases = [
    { ...question, options: ["X", "O"] },
    { ...question, answer: 2 },
    { ...question, exp: "" },
    { ...question, type: "choice", options: ["1", "2", "3", "4"] },
  ];
  for (const item of cases) assert.equal((await handler({ generate: async () => [item] })(request(valid))).status, 502);
});
