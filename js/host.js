// 진행자 화면: 방 만들기, 문제 진행, 채점, 순위 표시
import { at, set, update, get, onValue, serverTimestamp, calcPoints, esc } from "./db.js";
import { questions, TIME_LIMIT } from "./questions.js";
import qrcode from "https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.mjs";

const $ = (id) => document.getElementById(id);
const screens = ["lobby", "question", "reveal", "end"];
const show = (name) => screens.forEach((s) => ($(s).hidden = s !== name));

let pin = "";
let game = {};      // DB의 게임 데이터 최신본
let qIndex = -1;
let timer = null;
let revealing = false;

const players = () => Object.entries(game.players || {}).map(([id, p]) => ({ id, ...p }));
const ranking = () => players().sort((a, b) => b.score - a.score);

async function createRoom() {
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while ((await get(at(`games/${pin}`))).exists());
  await set(at(`games/${pin}`), { state: "lobby", q: -1, createdAt: serverTimestamp() });

  const playUrl = new URL("play.html", location.href).href;
  $("pin").textContent = pin;
  $("join-url").textContent = playUrl.replace(/^https?:\/\//, "");

  // QR에는 PIN을 붙인 주소를 넣어 찍으면 PIN이 자동으로 채워지게 함
  const qr = qrcode(0, "M");
  qr.addData(`${playUrl}?pin=${pin}`);
  qr.make();
  $("qr").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
  $("total-q").textContent = questions.length;
  show("lobby");

  onValue(at(`games/${pin}`), (snap) => {
    game = snap.val() || {};
    renderLobby();
    renderAnswerCount();
  });
}

function renderLobby() {
  const list = players();
  $("player-count").textContent = list.length;
  $("player-list").innerHTML = list.map((p) => `<li>${esc(p.name)}</li>`).join("");
  $("start-btn").disabled = list.length === 0;
}

function renderAnswerCount() {
  if (game.state !== "question") return;
  const answered = Object.keys(game.answers?.[qIndex] || {}).length;
  const total = players().length;
  $("answer-count").textContent = `${answered} / ${total}명 응답`;
  if (total > 0 && answered >= total) reveal();
}

async function goQuestion(i) {
  qIndex = i;
  revealing = false;
  const item = questions[i];
  $("q-num").textContent = `${i + 1} / ${questions.length}`;
  $("q-text").textContent = item.q;
  $("answer-count").textContent = `0 / ${players().length}명 응답`;
  show("question");
  await update(at(`games/${pin}`), { state: "question", q: i, qStart: serverTimestamp() });

  let left = TIME_LIMIT;
  $("timer").textContent = left;
  clearInterval(timer);
  timer = setInterval(() => {
    left -= 1;
    $("timer").textContent = Math.max(left, 0);
    if (left <= 0) reveal();
  }, 1000);
}

async function reveal() {
  if (revealing) return;
  revealing = true;
  clearInterval(timer);

  const snap = (await get(at(`games/${pin}`))).val();
  const answers = snap.answers?.[qIndex] || {};
  const item = questions[qIndex];
  const changes = { state: "reveal" };
  const scored = [];
  let o = 0, x = 0;

  for (const [id, p] of Object.entries(snap.players || {})) {
    const ans = answers[id];
    if (ans?.a === "O") o++;
    if (ans?.a === "X") x++;
    const pts = ans ? calcPoints(ans.a === item.a, ans.t - snap.qStart, TIME_LIMIT) : 0;
    const score = (p.score || 0) + pts;
    changes[`players/${id}/score`] = score;
    changes[`players/${id}/last`] = pts;
    scored.push({ name: p.name, score });
  }
  await update(at(`games/${pin}`), changes);

  $("r-num").textContent = `${qIndex + 1} / ${questions.length}`;
  $("r-text").textContent = item.q;
  $("r-answer").textContent = item.a;
  $("r-answer").className = `big-mark mark-${item.a}`;
  $("r-exp").textContent = item.exp || "";
  $("count-o").textContent = o;
  $("count-x").textContent = x;
  $("bar-o").classList.toggle("correct", item.a === "O");
  $("bar-x").classList.toggle("correct", item.a === "X");
  $("top5").innerHTML = scored.sort((a, b) => b.score - a.score).slice(0, 5)
    .map((p) => `<li><span>${esc(p.name)}</span><b>${p.score}</b></li>`).join("");
  $("next-btn").textContent = qIndex + 1 < questions.length ? "다음 문제 ▶" : "최종 결과 보기 🏆";
  show("reveal");
}

async function finish() {
  await update(at(`games/${pin}`), { state: "end" });
  const top = ranking();
  [1, 2, 3].forEach((n) => {
    const p = top[n - 1];
    $(`p${n}-name`).textContent = p ? p.name : "-";
    $(`p${n}-score`).textContent = p ? `${p.score}점` : "";
  });
  $("rest").innerHTML = top.slice(3)
    .map((p, i) => `<li><span>${i + 4}. ${esc(p.name)}</span><b>${p.score}</b></li>`).join("");
  show("end");
}

$("start-btn").onclick = () => goQuestion(0);
$("skip-btn").onclick = () => reveal();
$("next-btn").onclick = () => (qIndex + 1 < questions.length ? goQuestion(qIndex + 1) : finish());
$("again-btn").onclick = () => location.reload();

createRoom().catch((e) => {
  $("lobby").hidden = false;
  $("pin").textContent = "연결 실패";
  $("join-url").textContent = "js/config.js의 Firebase 설정을 확인하세요";
  console.error(e);
});
