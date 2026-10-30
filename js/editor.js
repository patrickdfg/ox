import { loadQuiz, saveQuiz, themes, escapeHtml as esc } from "./store.js";
import { auth, watchAuth, login } from "./auth.js";

const $ = id => document.getElementById(id);
const id = new URLSearchParams(location.search).get("id");
let quiz = { id: crypto.randomUUID(), title: "", description: "", theme: "cosmic", questions: [] };
let ownerUid = "", authRequest = 0;
let imagesLoading = 0;

function renderThemes() {
  $("themes").innerHTML = themes.map(theme => `<button type="button" class="theme-choice ${quiz.theme === theme.id ? "selected" : ""}" data-theme="${theme.id}" aria-pressed="${quiz.theme === theme.id}"><span class="theme-preview theme-${theme.id}"><i>✦</i><b>✳</b></span><strong>${theme.name}</strong><small>${theme.detail}</small></button>`).join("");
}
function renderQuestions() {
  $("question-count").textContent = quiz.questions.length;
  $("questions").innerHTML = quiz.questions.map((item, i) => `<article class="question-editor"><div class="question-head"><div><span class="number-badge">${String(i + 1).padStart(2, "0")}</span><strong>${item.type === "ox" ? "O/X 문제" : "객관식 문제"}</strong></div><div class="question-tools"><button data-action="up" data-i="${i}" aria-label="문제 위로 이동" ${i === 0 ? "disabled" : ""}>↑</button><button data-action="down" data-i="${i}" aria-label="문제 아래로 이동" ${i === quiz.questions.length - 1 ? "disabled" : ""}>↓</button><button data-action="delete" data-i="${i}" aria-label="문제 삭제">✕</button></div></div><label class="field">문제<input data-field="q" data-i="${i}" value="${esc(item.q)}" maxlength="250" placeholder="문제를 입력하세요"></label><div class="image-field"><label class="upload-label">🖼️ 문제 이미지 추가<input type="file" accept="image/jpeg,image/png,image/webp" data-field="image" data-i="${i}"></label><span>선택 · 사진은 자동으로 크기를 줄여 저장해요</span>${item.image ? `<div class="image-preview"><img src="${esc(item.image)}" alt="문제 이미지 미리보기"><button type="button" data-action="remove-image" data-i="${i}">이미지 삭제</button></div>` : ""}</div><div class="field"><span>정답 선택 <small class="optional">정답을 눌러 선택하세요</small></span><div class="editor-options">${item.options.map((option, j) => `<div class="option-edit"><button class="correct-pick ${item.answer === j ? "picked" : ""}" data-action="answer" data-i="${i}" data-j="${j}" aria-label="${j + 1}번 정답 선택" aria-pressed="${item.answer === j}">${item.answer === j ? "✓" : j + 1}</button><input data-field="option" data-i="${i}" data-j="${j}" value="${esc(option)}" maxlength="100" ${item.type === "ox" ? "readonly" : ""} placeholder="보기 ${j + 1}"></div>`).join("")}</div></div><div class="question-details"><label class="field">해설 <span class="optional">선택</span><input data-field="exp" data-i="${i}" value="${esc(item.exp)}" maxlength="300" placeholder="정답에 대한 설명을 입력하세요"></label><label class="field time-field">제한 시간<select data-field="time" data-i="${i}">${[10, 20, 30, 45, 60, 90, 120].map(n => `<option value="${n}" ${item.time === n ? "selected" : ""}>${n}초</option>`).join("")}</select></label></div></article>`).join("");
}
$("themes").addEventListener("click", event => {
  const button = event.target.closest("[data-theme]");
  if (button) { quiz.theme = button.dataset.theme; renderThemes(); }
});
$("questions").addEventListener("input", event => {
  const el = event.target, item = quiz.questions[Number(el.dataset.i)];
  if (!item) return;
  if (el.dataset.field === "image") return;
  if (el.dataset.field === "option") item.options[Number(el.dataset.j)] = el.value;
  else if (el.dataset.field === "time") item.time = Number(el.value);
  else if (el.dataset.field) item[el.dataset.field] = el.value;
});
$("questions").addEventListener("change", event => {
  const input = event.target;
  if (input.dataset.field !== "image" || !input.files[0]) return;
  const item = quiz.questions[Number(input.dataset.i)];
  const file = input.files[0];
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    $("editor-message").textContent = "JPG, PNG 또는 WebP 이미지를 10MB 이하로 선택해 주세요.";
    input.value = "";
    return;
  }
  imagesLoading++;
  $("editor-message").textContent = "이미지를 준비하고 있어요.";
  const reader = new FileReader();
  reader.onerror = () => { imagesLoading--; $("editor-message").textContent = "이미지를 읽지 못했어요. 다시 선택해 주세요."; };
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => { imagesLoading--; $("editor-message").textContent = "이미지를 열지 못했어요. 다른 파일을 선택해 주세요."; };
    image.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (quiz.questions.includes(item)) item.image = canvas.toDataURL("image/jpeg", .75);
      imagesLoading--;
      $("editor-message").textContent = imagesLoading ? "이미지를 준비하고 있어요." : "";
      renderQuestions();
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
});
$("questions").addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const i = Number(button.dataset.i), action = button.dataset.action;
  if (action === "answer") quiz.questions[i].answer = Number(button.dataset.j);
  if (action === "delete") quiz.questions.splice(i, 1);
  if (action === "remove-image") delete quiz.questions[i].image;
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
async function save() {
  if (imagesLoading) { $("editor-message").textContent = "이미지 준비가 끝나면 저장해 주세요."; return; }
  if (!ownerUid || auth.currentUser?.uid !== ownerUid) { $("editor-message").textContent = "다시 로그인한 후 저장해 주세요."; return; }
  quiz.title = $("quiz-title").value.trim();
  quiz.description = $("quiz-description").value.trim();
  let error = !quiz.title ? "퀴즈 제목을 입력해 주세요." : !quiz.questions.length ? "문제를 하나 이상 추가해 주세요." : "";
  for (let i = 0; !error && i < quiz.questions.length; i++) {
    const item = quiz.questions[i];
    if (!item.q.trim()) error = `${i + 1}번 문제를 입력해 주세요.`;
    else if (item.options.some(option => !option.trim())) error = `${i + 1}번 문제의 보기를 모두 입력해 주세요.`;
  }
  if (error) { $("editor-message").textContent = error; $("editor-message").scrollIntoView({ behavior: "smooth", block: "center" }); return; }
  $("save-btn").disabled = true;
  $("save-bottom").disabled = true;
  try { await saveQuiz(ownerUid, quiz); location.href = "index.html"; }
  catch (error) { console.error(error); $("editor-message").textContent = "저장하지 못했어요. 인터넷 연결과 Firebase 설정을 확인해 주세요."; }
  finally { $("save-btn").disabled = false; $("save-bottom").disabled = false; }
}
$("save-btn").onclick = save;
$("save-bottom").onclick = save;
$("editor-login").onclick = async () => {
  try { await login(); }
  catch (error) { console.error(error); $("auth-message").textContent = "로그인하지 못했어요. 팝업 허용과 Firebase 설정을 확인해 주세요."; }
};
watchAuth(async user => {
  const request = ++authRequest;
  ownerUid = "";
  $("editor-layout").hidden = true;
  $("editor-auth").hidden = false;
  if (!user) return;
  $("auth-message").textContent = "내 퀴즈를 불러오는 중이에요.";
  try {
    const loaded = id ? await loadQuiz(user.uid, id) : null;
    if (request !== authRequest) return;
    if (id && !loaded) { $("auth-message").textContent = "이 계정에서 해당 퀴즈를 찾을 수 없어요."; return; }
    quiz = loaded || { id: crypto.randomUUID(), title: "", description: "", theme: "cosmic", questions: [] };
    ownerUid = user.uid;
    $("quiz-title").value = quiz.title;
    $("quiz-description").value = quiz.description || "";
    $("auth-message").textContent = "";
    $("editor-message").textContent = "";
    renderThemes();
    renderQuestions();
    $("editor-auth").hidden = true;
    $("editor-layout").hidden = false;
  } catch (error) {
    console.error(error);
    if (request === authRequest) $("auth-message").textContent = "퀴즈를 불러오지 못했어요. Firebase 설정을 확인해 주세요.";
  }
});
