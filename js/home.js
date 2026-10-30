import { loadQuizzes, saveQuizzes, sampleQuiz, escapeHtml as esc, themes } from "./store.js";

const list = document.getElementById("quiz-list");
function render() {
  const quizzes = loadQuizzes();
  const cards = [sampleQuiz(), ...quizzes];
  list.innerHTML = cards.map(quiz => {
    const theme = themes.find(item => item.id === quiz.theme) || themes[0];
    return `<article class="quiz-card"><div class="quiz-cover theme-${esc(theme.id)}"><span>✦ QUIZ PLAY</span><strong>${quiz.questions.length}<small> QUESTIONS</small></strong><i>✳</i></div><div class="quiz-card-body"><span class="card-tag">${quiz.id === "sample" ? "기본 퀴즈" : "내 퀴즈"}</span><h3>${esc(quiz.title)}</h3><p>${esc(quiz.description || "나만의 퀴즈를 플레이해 보세요.")}</p><div class="card-actions"><a class="play-link" href="host.html?quiz=${encodeURIComponent(quiz.id)}">게임 시작 →</a>${quiz.id === "sample" ? "" : `<a href="editor.html?id=${encodeURIComponent(quiz.id)}">수정</a><button data-delete="${esc(quiz.id)}">삭제</button>`}</div></div></article>`;
  }).join("");
}
list.addEventListener("click", event => {
  const id = event.target.dataset.delete;
  if (!id || !confirm("이 퀴즈를 삭제할까요?")) return;
  saveQuizzes(loadQuizzes().filter(quiz => quiz.id !== id));
  render();
});
render();
