// 참가자 화면: PIN으로 입장, O/X 답 제출, 결과 확인
import { at, set, get, onValue, serverTimestamp } from "./db.js";
import { questions, TIME_LIMIT } from "./questions.js";

const $ = (id) => document.getElementById(id);
const screens = ["join", "wait", "question", "sent", "result", "end"];
const show = (name) => screens.forEach((s) => ($(s).hidden = s !== name));

let pin = "";
let pid = "";
let lastKey = "";   // 같은 화면을 다시 그리지 않도록 상태+문제번호 기억
let timer = null;

const params = new URLSearchParams(location.search);
if (params.get("pin")) $("pin-input").value = params.get("pin");

$("join-form").onsubmit = async (e) => {
  e.preventDefault();
  const inputPin = $("pin-input").value.trim();
  const name = $("name-input").value.trim();
  $("join-msg").textContent = "";
  if (!/^\d{6}$/.test(inputPin)) return ($("join-msg").textContent = "PIN 6자리 숫자를 입력하세요.");
  if (!name) return ($("join-msg").textContent = "닉네임을 입력하세요.");

  const snap = await get(at(`games/${inputPin}`));
  if (!snap.exists()) return ($("join-msg").textContent = "그런 방이 없어요. PIN을 확인하세요.");
  if (snap.val().state === "end") return ($("join-msg").textContent = "이미 끝난 게임이에요.");

  pin = inputPin;
  const saved = sessionStorage.getItem(`ox-${pin}`);
  pid = saved || Math.random().toString(36).slice(2, 10);
  sessionStorage.setItem(`ox-${pin}`, pid);
  if (!saved || !snap.val().players?.[pid]) {
    await set(at(`games/${pin}/players/${pid}`), { name: name.slice(0, 12), score: 0, last: 0 });
  }
  $("me").textContent = name.slice(0, 12);
  onValue(at(`games/${pin}`), (s) => render(s.val() || {}));
};

function render(game) {
  const key = `${game.state}-${game.q}`;
  if (key === lastKey) return;
  lastKey = key;
  clearInterval(timer);
  const me = game.players?.[pid];

  if (game.state === "lobby") return show("wait");

  if (game.state === "question") {
    if (game.answers?.[game.q]?.[pid]) return show("sent");
    $("pq-num").textContent = `${game.q + 1} / ${questions.length}`;
    $("pq-text").textContent = questions[game.q].q;
    let left = TIME_LIMIT;
    $("p-timer").textContent = left;
    timer = setInterval(() => ($("p-timer").textContent = Math.max(--left, 0)), 1000);
    document.querySelectorAll(".ox-btn").forEach((b) => (b.disabled = false));
    return show("question");
  }

  if (game.state === "reveal") {
    const ok = me?.last > 0;
    $("result-title").textContent = ok ? "정답! 🎉" : "아쉬워요 😢";
    $("result").className = ok ? "screen good" : "screen bad";
    $("result-points").textContent = ok ? `+${me.last}점` : "+0점";
    $("result-answer").textContent = `정답은 ${questions[game.q].a}`;
    $("result-total").textContent = `총점 ${me?.score || 0}점 · ${rankOf(game)}등`;
    return show("result");
  }

  if (game.state === "end") {
    $("end-rank").textContent = `${rankOf(game)}등`;
    $("end-score").textContent = `${me?.score || 0}점`;
    return show("end");
  }
}

function rankOf(game) {
  const mine = game.players?.[pid]?.score || 0;
  return Object.values(game.players || {}).filter((p) => p.score > mine).length + 1;
}

document.querySelectorAll(".ox-btn").forEach((btn) => {
  btn.onclick = async () => {
    document.querySelectorAll(".ox-btn").forEach((b) => (b.disabled = true));
    const q = Number(lastKey.split("-")[1]);
    await set(at(`games/${pin}/answers/${q}/${pid}`), { a: btn.dataset.a, t: serverTimestamp() });
    show("sent");
  };
});
