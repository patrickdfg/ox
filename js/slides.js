// 저장된 퀴즈를 수업 복습용 프레젠테이션으로 표시하고 클릭마다 정답과 다음 문제를 전환합니다.
import { loadQuiz, sampleQuiz, escapeHtml as esc } from "./store.js";
import { auth, watchAuth, login } from "./auth.js";
import { advanceSlide, retreatSlide } from "./slide-state.mjs";

const $ = id => document.getElementById(id);
const quizId = new URLSearchParams(location.search).get("quiz") || "sample";
let quiz = null;
let state = { index: 0, revealed: false, finished: false };
let request = 0;

function render() {
  if (!quiz) return;
  const total = quiz.questions.length;
  const step = $("slide-step");
  if (state.finished) {
    $("slide-stage").innerHTML = `<article class="slide-card slide-finish"><span class="slide-overline">REVIEW COMPLETE</span><h1>복습을 마쳤습니다!</h1><p>${total}문제를 모두 확인했어요.</p><span class="slide-repeat">아래 ‘처음부터’ 버튼으로 다시 볼 수 있어요.</span></article>`;
    $("slide-next").textContent = "처음부터 ↻";
    $("slide-prev").disabled = false;
    step.textContent = `${total} / ${total} · 완료`;
    return;
  }
  const q = quiz.questions[state.index];
  const reveal = state.revealed;
  const answer = Number(q.answer);
  const image = typeof q.image === "string" && (/^data:image\/(png|jpeg|webp);base64,/i.test(q.image) || /^https:\/\//i.test(q.image))
    ? `<img class="slide-image" src="${esc(q.image)}" alt="문제 그림">` : "";
  const choices = (q.options || []).map((option, n) =>
    `<div class="slide-option ${reveal && n === answer ? "is-correct" : ""} ${reveal && n !== answer ? "is-muted" : ""}">
      <strong>${q.type === "ox" ? (n === 0 ? "O" : "X") : n + 1}</strong><span>${esc(option)}</span>
    </div>`
  ).join("");
  $("slide-stage").innerHTML = `<article class="slide-card ${quiz.theme ? "theme-" + esc(quiz.theme) : ""}">
    <div class="slide-counter"><span class="slide-overline">QUIZ REVIEW</span><span>${state.index + 1} / ${total}</span></div>
    <h1 class="slide-question">${esc(q.q)}</h1>
    ${image}
    <div class="slide-options ${q.type === "ox" ? "is-ox" : ""}">${choices}</div>
    ${reveal ? `<div class="slide-explanation"><strong>✓ 정답 ${esc((q.options || [])[answer] ?? "")}</strong>${q.exp ? `<p>${esc(q.exp)}</p>` : ""}</div>` : '<p class="slide-prompt">화면을 클릭하면 정답이 나타납니다.</p>'}
  </article>`;
  $("slide-next").textContent = reveal ? (state.index === total - 1 ? "복습 마치기 →" : "다음 문제 →") : "정답 공개 →";
  $("slide-prev").disabled = state.index === 0 && !reveal;
  step.textContent = `${state.index + 1} / ${total} · ${reveal ? "정답 공개" : "문제"}`;
}

function advance() {
  if (!quiz) return;
  if (state.finished) state = { index: 0, revealed: false, finished: false };
  else state = advanceSlide(state, quiz.questions.length);
  render();
}
function retreat() {
  if (!quiz) return;
  state = retreatSlide(state, quiz.questions.length);
  render();
}
function openQuiz(value) {
  if (!Array.isArray(value?.questions) || !value.questions.length) {
    showMessage("복습할 문제가 없습니다. 퀴즈를 확인해 주세요.");
    return;
  }
  quiz = value;
  state = { index: 0, revealed: false, finished: false };
  $("slide-title").textContent = value.title || "퀴즈 복습";
  $("slide-access").hidden = true;
  $("slide-layout").hidden = false;
  render();
}
function showMessage(message, needsLogin = false) {
  $("slide-layout").hidden = true;
  $("slide-access").hidden = false;
  $("slide-message").textContent = message;
  $("slide-login").hidden = !needsLogin;
}
$("slide-stage").addEventListener("click", advance);
$("slide-next").addEventListener("click", advance);
$("slide-prev").addEventListener("click", retreat);
$("slide-login").addEventListener("click", async () => {
  try { await login(); }
  catch (error) { console.error(error); showMessage("로그인하지 못했습니다. 다시 시도해 주세요.", true); }
});
$("fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) { console.error(error); }
});
document.addEventListener("fullscreenchange", () => {
  $("fullscreen").textContent = document.fullscreenElement ? "⛶ 전체화면 종료" : "⛶ 전체화면";
});
document.addEventListener("keydown", event => {
  if ($("slide-layout").hidden || event.altKey || event.ctrlKey || event.metaKey) return;
  if (["ArrowRight", "PageDown"].includes(event.key) || ([" ", "Enter"].includes(event.key) && !event.target.closest("button, a"))) {
    event.preventDefault();
    advance();
  } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
    event.preventDefault();
    retreat();
  }
});

if (quizId === "sample") openQuiz(sampleQuiz());
else watchAuth(async user => {
  const call = ++request;
  quiz = null;
  if (!user || user.isAnonymous) {
    showMessage("저장한 퀴즈는 Google 로그인 후 복습할 수 있습니다.", true);
    return;
  }
  showMessage("퀴즈를 불러오는 중입니다.");
  try {
    const value = await loadQuiz(user.uid, quizId);
    if (call !== request) return;
    if (!value) { showMessage("퀴즈를 찾지 못했습니다. 저장한 계정으로 로그인했는지 확인해 주세요."); return; }
    openQuiz(value);
  } catch (error) {
    console.error(error);
    if (call === request) showMessage("퀴즈를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.");
  }
});
