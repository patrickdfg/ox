import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, createHandler } from "../supabase/functions/quiz-ai/core.mjs";

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
test("입력을 검증하고 자체 사용량 제한 없이 생성한다", async () => {
  let generated = 0;
  const run = handler({ generate: async () => { generated++; return [question]; }, reserve: async () => { throw new Error("legacy quota must not run"); } });
  assert.equal((await run(request({ ...valid, source: "" }))).status, 400);
  assert.equal((await run(request({ ...valid, count: 21 }))).status, 400);
  for (let i = 0; i < 12; i++) assert.equal((await run(request({ ...valid, source: "초등학교 상식 퀴즈 내줘" }))).status, 200);
  assert.equal(generated, 12);
});
test("난이도 4단계의 지시문을 적용하고 생략 시 어려움을 기본값으로 사용한다", async () => {
  const guides = { easy: "기본 사실", normal: "핵심 개념", hard: "단순 암기보다", expert: "여러 핵심 개념의 연결" };
  for (const [level, phrase] of Object.entries(guides)) {
    const prompt = buildPrompt(source, 1, "choice", level);
    assert.match(prompt, new RegExp(phrase));
    assert.match(prompt, /객관식 오답 보기 품질/);
    assert.match(prompt, /그럴듯/);
  }
  assert.match(buildPrompt(source, 1, "choice"), /단순 암기보다/);
  const received = [];
  const run = handler({ generate: async (_source, _count, _type, _model, difficulty) => { received.push(difficulty); return [question]; } });
  assert.equal((await run(request(valid))).status, 200);
  assert.equal((await run(request({ ...valid, difficulty: "expert" }))).status, 200);
  assert.deepEqual(received, ["hard", "expert"]);
  for (const difficulty of ["medium", "", null, 10]) {
    assert.equal((await run(request({ ...valid, difficulty }))).status, 400);
  }
});

test("신앙 고난도 문제는 단순한 긍정·부정 대비와 비현실적인 오답을 피하도록 지시한다", () => {
  const manuscript = "주의 주관권을 벗어나면 사망과 사탄과 악의 주관권 아래에서 고통받는다고 설명한다.";
  for (const level of ["hard", "expert"]) {
    const prompt = buildPrompt(manuscript, 5, "choice", level);
    assert.match(prompt, /정답이 부정적인 결과라면 오답도 모두 부정적인 결과/);
    assert.match(prompt, /원고에서 구별한 주관 관계·상태·조건·원인·순서·결과/);
    assert.match(prompt, /긍정·부정 또는 비현실적인 보기만 제거해 풀 수 있는가/);
    assert.match(prompt, /원고에 없는 교리나 타 종파의 주장을 오답에 끼워 넣지 마세요/);
    assert.match(prompt, /원고 안에서 구별 가능한 내용/);
    assert.match(prompt, /사망과 사탄과 악의 주관권/);
  }
  assert.match(buildPrompt(manuscript, 5, "choice", "expert"), /좋은 결과·나쁜 결과 중 하나를 고르는 문제는 금지/);
});

test("Gemini 한도와 일시 장애를 구분한다", async () => {
  for (const status of [429, 503]) {
    const run = handler({ generate: async () => { throw { providerStatus: status }; } });
    assert.equal((await run(request(valid))).status, status);
  }
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

test("AI가 정답을 모두 1번에 배치해도 객관식 정답 위치를 골고루 바꾼다", async () => {
  const generated = Array.from({ length: 12 }, (_, index) => ({
    type: "choice",
    q: `성경 인물 문제 ${index + 1}`,
    options: [`정답 ${index}`, `오답 A ${index}`, `오답 B ${index}`, `오답 C ${index}`],
    answer: 0,
    exp: `해설 ${index}`
  }));
  const originalOptions = generated.map(item => [...item.options]);
  const run = handler({ generate: async () => generated });
  const result = await run(request({ source, count: 12, type: "choice" }));
  assert.equal(result.status, 200);
  const { questions } = await result.json();
  assert.equal(questions.length, 12);
  const positionCounts = [0, 0, 0, 0];
  questions.forEach((item, index) => {
    positionCounts[item.answer]++;
    assert.equal(item.options[item.answer], `정답 ${index}`);
    assert.deepEqual([...item.options].sort(), originalOptions[index].sort());
    assert.equal(item.exp, `해설 ${index}`);
  });
  assert.deepEqual(positionCounts, [3, 3, 3, 3]);
});

test("1차 모델이 막히거나 형식이 틀리면 대체 모델로 다시 만든다", async () => {
  for (const failure of [() => { throw { providerStatus: 429 }; }, () => { throw { providerStatus: 503 }; }, () => { throw new Error("timeout"); }, () => [{ ...question, answer: 5 }]]) {
    const used = [];
    const run = handler({ models: ["main", "backup"], generate: async (_s, _c, _t, model) => { used.push(model); return model === "main" ? failure() : [question]; } });
    const result = await run(request(valid));
    assert.equal(result.status, 200);
    assert.deepEqual(used, ["main", "backup"]);
  }
});
test("두 모델이 모두 실패하면 마지막 오류로 안내한다", async () => {
  const run = handler({ models: ["main", "backup"], generate: async (_s, _c, _t, model) => { throw { providerStatus: model === "main" ? 503 : 429 }; } });
  const result = await run(request(valid));
  assert.equal(result.status, 429);
  assert.match((await result.json()).error, /대체 모델/);
});
