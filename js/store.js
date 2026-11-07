import { at, get, set, remove } from "./db.js";
import { questions as sampleQuestions, bibleQuestions, TIME_LIMIT } from "./questions.js";

export const themes = [
  { id: "cosmic", name: "코스믹 파티", detail: "반짝이는 우주" },
  { id: "sunset", name: "캔디 선셋", detail: "달콤한 노을빛" },
  { id: "ocean", name: "오션 어드벤처", detail: "시원한 바닷속" },
  { id: "forest", name: "포레스트 캠프", detail: "싱그러운 숲속" },
  { id: "neon", name: "네온 아케이드", detail: "빛나는 게임장" },
  { id: "volcano", name: "볼케이노 런", detail: "뜨거운 화산" },
];
export async function loadQuizzes(uid) {
  const snapshot = await get(at(`quizzes/${uid}`));
  return Object.values(snapshot.val() || {});
}
export async function loadQuiz(uid, id) {
  const snapshot = await get(at(`quizzes/${uid}/${id}`));
  return snapshot.val();
}
export const saveQuiz = (uid, quiz) => set(at(`quizzes/${uid}/${quiz.id}`), quiz);
export const deleteQuiz = (uid, id) => remove(at(`quizzes/${uid}/${id}`));
const oxQuestions = list => list.map(item => ({ type: "ox", q: item.q, options: ["O", "X"], answer: item.a === "O" ? 0 : 1, exp: item.exp, time: TIME_LIMIT }));
export function sampleQuiz() {
  return { id: "sample", title: "컴퓨터 상식 O/X 퀴즈", description: "기본으로 준비된 20개의 문제", theme: "cosmic", questions: oxQuestions(sampleQuestions) };
}
export const sampleQuizzes = () => [sampleQuiz(), { id: "sample-bible", title: "성경인물 20선 O/X 퀴즈", description: "성경 속 인물 20명을 만나는 20개의 문제", theme: "forest", questions: oxQuestions(bibleQuestions) }];
export const findSample = id => sampleQuizzes().find(quiz => quiz.id === id);
export const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
