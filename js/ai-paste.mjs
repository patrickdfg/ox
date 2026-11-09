// Gemini가 막힐 때 다른 AI(ChatGPT·Claude 등)에 줄 프롬프트를 만들고, 받은 JSON 답을 퀴즈 문항으로 바꿉니다.
import { buildPrompt, normalizeQuestion, distributeChoiceAnswers } from "../supabase/functions/quiz-ai/core.mjs";

export function buildPastePrompt(source, count, type, difficulty = "hard") {
  return buildPrompt(source, count, type, difficulty) + `

답은 설명이나 인사말 없이 아래 형식의 JSON만 출력하세요.
{"questions":[{"type":"ox","q":"문제","options":["O","X"],"answer":0,"exp":"해설"},{"type":"choice","q":"문제","options":["보기1","보기2","보기3","보기4"],"answer":2,"exp":"해설"}]}`;
}

export function parsePastedQuestions(text) {
  const start = text.search(/[[{]/), end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("붙여 넣은 내용에서 문제 JSON을 찾지 못했어요. AI 답을 그대로 붙여 넣어 주세요.");
  let data;
  try { data = JSON.parse(text.slice(start, end + 1)); }
  catch { throw new Error("JSON 형식이 깨져 있어요. AI 답을 처음부터 끝까지 빠짐없이 복사해 주세요."); }
  const items = Array.isArray(data) ? data : data?.questions;
  if (!Array.isArray(items) || !items.length) throw new Error("붙여 넣은 내용에 문제가 없어요.");
  if (items.length > 20) throw new Error("한 번에 20문제까지 추가할 수 있어요.");
  const questions = items.map((item, i) => {
    try { return normalizeQuestion(item); }
    catch { throw new Error(`${i + 1}번 문제의 형식이 맞지 않아요. 유형·보기 수·정답 번호·해설을 확인해 주세요.`); }
  });
  return distributeChoiceAnswers(questions);
}
