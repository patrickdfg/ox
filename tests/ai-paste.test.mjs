// 다른 AI 답을 붙여 넣어 문제로 바꾸는 기능을 검사합니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPastePrompt, parsePastedQuestions } from "../js/ai-paste.mjs";

const ox = { type: "ox", q: "물은 100도에서 끓는다.", options: ["O", "X"], answer: 0, exp: "1기압에서 물은 100도에서 끓습니다." };
const choice = { type: "choice", q: "가장 큰 행성은?", options: ["목성", "지구", "화성", "금성"], answer: 0, exp: "목성이 가장 큽니다." };

test("프롬프트에 원고·문제 수와 JSON 형식 안내가 들어간다", () => {
  const prompt = buildPastePrompt("태양계 원고", 7, "mixed");
  assert.match(prompt, /태양계 원고/);
  assert.match(prompt, /퀴즈 7개/);
  assert.match(prompt, /JSON만 출력/);
});
test("말씀과 수업 원고에 핵심·중복·정확성 기준과 기존 유형을 함께 적용한다", () => {
  const sermon = buildPastePrompt("중요한 가르침과 실천을 기억합시다.", 5, "ox");
  const lesson = buildPastePrompt("파이썬 함수는 여러 값을 튜플로 반환합니다.", 10, "choice");
  for (const prompt of [sermon, lesson]) {
    assert.match(prompt, /중요도가 높은 내용/);
    assert.match(prompt, /골고루 포함/);
    assert.match(prompt, /반복 출제하지 마세요/);
    assert.match(prompt, /원고에 없는 사실을 추가하지 마세요/);
    assert.match(prompt, /말씀·설교·성경 공부/);
    assert.match(prompt, /학교·학원 수업/);
    assert.match(prompt, /문제·정답·해설이 서로 일치/);
    assert.match(prompt, /JSON만 출력/);
  }
  assert.match(sermon, /퀴즈 5개/);
  assert.match(sermon, /O\/X만/);
  assert.match(lesson, /퀴즈 10개/);
  assert.match(lesson, /4지선다 객관식만/);
});

test("코드 블록·설명문이 섞인 답과 배열 형태도 읽는다", () => {
  const text = "네, 만들었어요!\n```json\n" + JSON.stringify({ questions: [ox, choice] }) + "\n```\n확인해 보세요.";
  const questions = parsePastedQuestions(text);
  assert.equal(questions.length, 2);
  assert.equal(questions[1].options[questions[1].answer], "목성");
  assert.equal(questions[0].time, 20);
  assert.equal(parsePastedQuestions(JSON.stringify([ox])).length, 1);
});
test("형식이 틀린 답은 몇 번 문제인지 알려 준다", () => {
  assert.throws(() => parsePastedQuestions("JSON이 없어요"), /JSON을 찾지/);
  assert.throws(() => parsePastedQuestions('{"questions":[{"type":"ox"'), /찾지|깨져/);
  assert.throws(() => parsePastedQuestions(JSON.stringify({ questions: [ox, { ...choice, options: ["1", "2", "3"] }] })), /2번 문제/);
  assert.throws(() => parsePastedQuestions(JSON.stringify({ questions: Array(21).fill(ox) })), /20문제/);
});
