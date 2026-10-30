import { loadQuizzes, deleteQuiz, sampleQuiz, escapeHtml as esc, themes } from "./store.js";
import { auth, watchAuth, login, logout } from "./auth.js";

const list = document.getElementById("quiz-list");
const account = document.getElementById("account-btn");
const status = document.getElementById("account-status");
let request = 0;
async function render(user) {
  const current = ++request;
  list.innerHTML = "<p class='library-message'>퀴즈를 불러오는 중이에요.</p>";
  let quizzes = [];
  try { if (user) quizzes = await loadQuizzes(user.uid); }
  catch (error) {
    console.error(error);
    if (current === request) list.innerHTML = "<p class='library-message'>퀴즈를 불러오지 못했어요. Firebase 설정과 연결을 확인해 주세요.</p>";
    return;
  }
  if (current !== request) return;
  const cards = [sampleQuiz(), ...quizzes];
  list.innerHTML = cards.map(quiz => {
    const theme = themes.find(item => item.id === quiz.theme) || themes[0];
    return `<article class="quiz-card"><div class="quiz-cover theme-${esc(theme.id)}"><span>✦ QUIZ PLAY</span><strong>${quiz.questions.length}<small> QUESTIONS</small></strong><i>✳</i></div><div class="quiz-card-body"><span class="card-tag">${quiz.id === "sample" ? "기본 퀴즈" : "내 퀴즈"}</span><h3>${esc(quiz.title)}</h3><p>${esc(quiz.description || "나만의 퀴즈를 플레이해 보세요.")}</p><div class="card-actions"><a class="play-link" href="host.html?quiz=${encodeURIComponent(quiz.id)}">게임 시작 →</a>${quiz.id === "sample" ? "" : `<a href="editor.html?id=${encodeURIComponent(quiz.id)}">수정</a><button data-delete="${esc(quiz.id)}">삭제</button>`}</div></div></article>`;
  }).join("") + (user ? "" : "<p class='library-message'>Google 로그인 후 내 퀴즈를 저장하고 불러올 수 있어요.</p>");
}
list.addEventListener("click", async event => {
  const id = event.target.dataset.delete, user = auth.currentUser;
  if (!id || !user || !confirm("이 퀴즈를 삭제할까요?")) return;
  try { await deleteQuiz(user.uid, id); if (auth.currentUser?.uid === user.uid) render(user); }
  catch (error) { console.error(error); status.textContent = "삭제하지 못했어요. 다시 시도해 주세요."; }
});
account.onclick = async () => {
  try { if (auth.currentUser) await logout(); else await login(); }
  catch (error) { console.error(error); status.textContent = "로그인하지 못했어요. 팝업 허용과 Firebase 설정을 확인해 주세요."; }
};
watchAuth(user => {
  account.textContent = user ? "로그아웃" : "Google 로그인";
  status.textContent = user ? `${user.displayName || user.email}님으로 로그인` : "";
  render(user);
});
