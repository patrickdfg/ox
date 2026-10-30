import { at, set, update, get, onValue, serverTimestamp, calcPoints, esc } from "./db.js";
import { loadQuizzes, sampleQuiz } from "./store.js";
import qrcode from "https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.mjs";

const $ = id => document.getElementById(id);
const show = name => ["lobby", "question", "reveal", "end"].forEach(s => $(s).hidden = s !== name);
const quizId = new URLSearchParams(location.search).get("quiz") || "sample";
const quiz = quizId === "sample" ? sampleQuiz() : loadQuizzes().find(item => item.id === quizId);
let pin = "", game = {}, qIndex = -1, timer = null, revealing = false;
const players = () => Object.entries(game.players || {}).map(([id, player]) => ({ id, ...player }));
const ranking = () => players().sort((a, b) => b.score - a.score);
const rankHtml = list => list.map(p => `<li><span>${esc(p.name)}</span><b>${p.score || 0}점</b></li>`).join("");

async function createRoom() {
  if (!quiz) {
    show("lobby");
    $("pin").textContent = "퀴즈 없음";
    $("game-error").textContent = "저장한 브라우저에서 퀴즈를 다시 열어 주세요.";
    return;
  }
  document.body.className = `game theme-${quiz.theme}`;
  $("game-title").textContent = quiz.title;
  do { pin = String(Math.floor(100000 + Math.random() * 900000)); }
  while ((await get(at(`games/${pin}`))).exists());
  await set(at(`games/${pin}`), { state: "lobby", q: -1, title: quiz.title, theme: quiz.theme, total: quiz.questions.length, createdAt: serverTimestamp() });
  const playUrl = new URL("play.html", location.href).href;
  $("pin").textContent = pin;
  $("join-url").textContent = playUrl.replace(/^https?:\/\//, "");
  const qr = qrcode(0, "M");
  qr.addData(`${playUrl}?pin=${pin}`);
  qr.make();
  $("qr").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
  $("total-q").textContent = quiz.questions.length;
  show("lobby");
  onValue(at(`games/${pin}`), snapshot => {
    game = snapshot.val() || {};
    const list = players();
    $("player-count").textContent = list.length;
    $("player-list").innerHTML = list.map(p => `<li>${esc(p.name)}</li>`).join("");
    $("start-btn").disabled = list.length === 0;
    if (game.state === "question") {
      const answered = Object.keys(game.answers?.[qIndex] || {}).length;
      $("answer-count").textContent = `${answered} / ${list.length}명 응답`;
      if (list.length && answered >= list.length) reveal();
    }
  });
}
async function goQuestion(i) {
  qIndex = i;
  revealing = false;
  const item = quiz.questions[i];
  $("q-num").textContent = `QUESTION ${i + 1} / ${quiz.questions.length}`;
  $("q-text").textContent = item.q;
  $("host-options").innerHTML = item.options.map((option, j) => `<div class="answer-tile color-${j}"><span>${["◆", "●", "▲", "■"][j]}</span>${esc(option)}</div>`).join("");
  $("answer-count").textContent = `0 / ${players().length}명 응답`;
  show("question");
  await update(at(`games/${pin}`), { state: "question", q: i, current: { q: item.q, options: item.options, time: item.time, type: item.type }, qStart: serverTimestamp(), reveal: null });
  let left = item.time;
  $("timer").textContent = left;
  clearInterval(timer);
  timer = setInterval(() => {
    $("timer").textContent = Math.max(--left, 0);
    if (left <= 0) reveal();
  }, 1000);
}
async function reveal() {
  if (revealing) return;
  revealing = true;
  clearInterval(timer);
  const snap = (await get(at(`games/${pin}`))).val();
  const answers = snap.answers?.[qIndex] || {};
  const item = quiz.questions[qIndex];
  const counts = item.options.map(() => 0);
  const changes = { state: "reveal", reveal: { answer: item.answer, text: item.options[item.answer], exp: item.exp || "" } };
  const scored = [];
  for (const [id, player] of Object.entries(snap.players || {})) {
    const answer = answers[id];
    if (answer && Number.isInteger(answer.a) && counts[answer.a] !== undefined) counts[answer.a]++;
    const elapsed = answer ? Math.max(0, answer.t - snap.qStart) : 0;
    const points = answer && elapsed <= item.time * 1000 ? calcPoints(answer.a === item.answer, elapsed, item.time) : 0;
    const score = (player.score || 0) + points;
    changes[`players/${id}/score`] = score;
    changes[`players/${id}/last`] = points;
    scored.push({ name: player.name, score });
  }
  await update(at(`games/${pin}`), changes);
  $("r-answer").textContent = item.options[item.answer];
  $("answer-stats").innerHTML = item.options.map((option, i) => `<div class="answer-tile color-${i} ${i === item.answer ? "correct" : ""}"><span>${esc(option)}</span><b>${counts[i]}명</b></div>`).join("");
  $("r-exp").textContent = item.exp || "";
  $("top5").innerHTML = rankHtml(scored.sort((a, b) => b.score - a.score).slice(0, 5));
  $("next-btn").textContent = qIndex + 1 < quiz.questions.length ? "다음 문제 →" : "최종 결과 보기 🏆";
  show("reveal");
}
async function finish() {
  await update(at(`games/${pin}`), { state: "end" });
  $("final-rank").innerHTML = rankHtml(ranking());
  show("end");
}
function report(error) { console.error(error); $("game-error").textContent = "연결에 문제가 생겼어요. 인터넷과 Firebase 설정을 확인해 주세요."; }
$("start-btn").onclick = () => goQuestion(0).catch(report);
$("skip-btn").onclick = () => reveal().catch(report);
$("next-btn").onclick = () => (qIndex + 1 < quiz.questions.length ? goQuestion(qIndex + 1) : finish()).catch(report);
createRoom().catch(error => { show("lobby"); $("pin").textContent = "연결 실패"; report(error); });
