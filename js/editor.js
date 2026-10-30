import { loadQuizzes, saveQuizzes, themes, escapeHtml as esc } from "./store.js";

const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");
const existing = loadQuizzes().find(item => item.id === id);
let quiz = existing || { id: crypto.randomUUID(), title: "", description: "", theme: "cosmic", questions: [] };
if (id && !existing) {
  $("editor-message").textContent = "퀴즈를 찾을 수 없어 새 퀴즈를 만들고 있어요.";
}
$("quiz-title").value = quiz.title;
$("quiz-description").value = quiz.description || "";

function renderThemes() {
  $("themes").innerHTML = themes.map(theme => `<button type="button" class="theme-choice ${quiz.theme === theme.id ? "selected" : ""}" data-theme="${theme.id}" aria-pressed="${quiz.theme === theme.id}"><span class="theme-preview theme-${theme.id}"><i>✦</i><b>✳</b></span><strong>${theme.name}</strong><small>${theme.detail}</small></button>`).join("");
}
function renderQuestions() {
  $("question-count").textContent = quiz.questions.length;
  $("questions").innerHTML = quiz.questions.map((item, i) => `<article class="question-editor"><div class="question-head"><div><span class="number-badge">${String(i + 1).padStart(2, "0")}</span><strong>${item.type === "ox" ? "O/X 문제" : "객관식 문제"}</strong></div><div class="question-tools"><button data-action="up" data-i="${i}" aria-label="문제 위로 이동" ${i === 0 ? "disabled" : ""}>↑</button><button data-action="down" data-i="${i}" aria-label="문제 아래로 이동" ${i === quiz.questions.length - 1 ? "disabled" : ""}>↓</button><button data-action="delete" data-i="${i}" aria-label="문제 삭제">✕</button></div></div><label class="field">문제<input data-field="q" data-i="${i}" value="${esc(item.q)}" maxlength="250" placeholder="문제를 입력하세요"></label><div class="field"><span>정답 선택 <small class="optional">정답을 눌러 선택하세요</small></span><div class="editor-options">${item.options.map((option, j) => `<div class="option-edit"><button class="correct-pick ${item.answer === j ? "picked" : ""}" data-action="answer" data-i="${i}" data-j="${j}" aria-label="${j + 1}번 정답 선택" aria-pressed="${item.answer === j}">${item.answer === j ? "✓" : j + 1}</button><input data-field="option" data-i="${i}" data-j="${j}" value="${esc(option)}" maxlength="100" ${item.type === "ox" ? "readonly" : ""} placeholder="보기 ${j + 1}"></div>`).join("")}</div></div><div class="question-details"><label class="field">해설 <span class="optional">선택</span><input data-field="exp" data-i="${i}" value="${esc(item.exp)}" maxlength="300" placeholder="정답에 대한 설명을 입력하세요"></label><label class="field time-field">제한 시간<select data-field="time" data-i="${i}">${[10, 20, 30, 45, 60, 90, 120].map(n => `<option value="${n}" ${item.time === n ? "selected" : ""}>${n}초</option>`).join("")}</select></label></div></article>`).join("");
}
$("themes").addEventListener("click", event => {
  const button = event.target.closest("[data-theme]");
  if (button) { quiz.theme = button.dataset.theme; renderThemes(); }
});
$("questions").addEventListener("input", event => {
  const el = event.target, item = quiz.questions[Number(el.dataset.i)];
  if (!item) return;
  if (el.dataset.field === "option") item.options[Number(el.dataset.j)] = el.value;
  else if (el.dataset.field === "time") item.time = Number(el.value);
  else if (el.dataset.field) item[el.dataset.field] = el.value;
});
$("questions").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const i = Number(button.dataset.i), action = button.dataset.action;
  if (action === "answer") quiz.questions[i].answer = Number(button.dataset.j);
  if (action === "delete") quiz.questions.splice(i, 1);
  if (action === "up" && i > 0) [quiz.questions[i - 1], quiz.questions[i]] = [quiz.questions[i], quiz.questions[i - 1]];
  if (action === "down" && i < quiz.questions.length - 1) [quiz.questions[i + 1], quiz.questions[i]] = [quiz.questions[i], quiz.questions[i + 1]];
  renderQuestions();
});
function add(type) {
  quiz.questions.push({ type, q: "", options: type === "ox" ? ["O", "X"] : ["", "", "", ""], answer: 0, exp: "", time: 20 });
  renderQuestions();
  $("questions").lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
}
$("add-ox").onclick = () => add("ox");
$("add-choice").onclick = () => add("choice");
function save() {
  quiz.title = $("quiz-title").value.trim();
  quiz.description = $("quiz-description").value.trim();
  let error = !quiz.title ? "퀴즈 제목을 입력해 주세요." : !quiz.questions.length ? "문제를 하나 이상 추가해 주세요." : "";
  for (let i = 0; !error && i < quiz.questions.length; i++) {
    const item = quiz.questions[i];
    if (!item.q.trim()) error = `${i + 1}번 문제를 입력해 주세요.`;
    else if (item.options.some(option => !option.trim())) error = `${i + 1}번 문제의 보기를 모두 입력해 주세요.`;
  }
  if (error) { $("editor-message").textContent = error; $("editor-message").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
  const quizzes = loadQuizzes().filter(item => item.id !== quiz.id);
  quizzes.push(quiz);
  try { saveQuizzes(quizzes); location.href = "index.html"; }
  catch { $("editor-message").textContent = "저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요."; }
}
$("save-btn").onclick = save;
$("save-bottom").onclick = save;
renderThemes();
renderQuestions();
