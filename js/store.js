import { questions as sampleQuestions, TIME_LIMIT } from "./questions.js";

const KEY = "quiz-play-quizzes-v1";
export const themes = [
  { id: "cosmic", name: "코스믹 파티", detail: "반짝이는 우주" },
  { id: "sunset", name: "캔디 선셋", detail: "달콤한 노을빛" },
  { id: "ocean", name: "오션 어드벤처", detail: "시원한 바닷속" },
];
export function loadQuizzes() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
export function saveQuizzes(quizzes) { localStorage.setItem(KEY, JSON.stringify(quizzes)); }
export function sampleQuiz() {
  return { id: "sample", title: "컴퓨터 상식 O/X 퀴즈", description: "기본으로 준비된 20개의 문제", theme: "cosmic", questions: sampleQuestions.map(item => ({ type: "ox", q: item.q, options: ["O", "X"], answer: item.a === "O" ? 0 : 1, exp: item.exp, time: TIME_LIMIT })) };
}
export const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
