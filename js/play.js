import { at, set, get, onValue, serverTimestamp, esc } from "./db.js";

const $ = id => document.getElementById(id);
const show = name => ["join", "wait", "question", "sent", "result", "end"].forEach(s => $(s).hidden = s !== name);
let pin = "", pid = "", lastKey = "", timer = null, currentGame = null;
const params = new URLSearchParams(location.search);
if (params.get("pin")) $("pin-input").value = params.get("pin");
$("join-form").onsubmit = async event => {
  event.preventDefault();
  const inputPin = $("pin-input").value.trim(), name = $("name-input").value.trim();
  $("join-msg").textContent = "";
  if (!/^\d{6}$/.test(inputPin)) return $("join-msg").textContent = "PIN 6자리 숫자를 입력하세요.";
  if (!name) return $("join-msg").textContent = "닉네임을 입력하세요.";
  try {
    const snapshot = await get(at(`games/${inputPin}`));
    if (!snapshot.exists()) return $("join-msg").textContent = "방을 찾을 수 없어요. PIN을 확인해 주세요.";
    if (snapshot.val().state === "end") return $("join-msg").textContent = "이미 끝난 게임이에요.";
    pin = inputPin;
    const saved = sessionStorage.getItem(`quiz-play-${pin}`);
    pid = saved || crypto.randomUUID();
    sessionStorage.setItem(`quiz-play-${pin}`, pid);
    if (!saved || !snapshot.val().players?.[pid]) await set(at(`games/${pin}/players/${pid}`), { name: name.slice(0, 12), score: 0, last: 0 });
    $("me").textContent = snapshot.val().players?.[pid]?.name || name;
    onValue(at(`games/${pin}`), snapshot => render(snapshot.val() || {}));
  } catch (error) { console.error(error); $("join-msg").textContent = "입장하지 못했어요. 인터넷 연결을 확인해 주세요."; }
};
function rankOf(game) {
  const mine = game.players?.[pid]?.score || 0;
  return Object.values(game.players || {}).filter(p => p.score > mine).length + 1;
}
function render(game) {
  currentGame = game;
  if (["cosmic", "sunset", "ocean"].includes(game.theme)) document.body.className = `game theme-${game.theme}`;
  const key = `${game.state}-${game.q}`;
  if (game.state === "question") $("player-rank").textContent = `🏆 ${rankOf(game)}위`;
  if (key === lastKey) return;
  lastKey = key;
  clearInterval(timer);
  const me = game.players?.[pid];
  if (game.state === "lobby") return show("wait");
  if (game.state === "question") {
    if (game.answers?.[game.q]?.[pid]) return show("sent");
    const item = game.current;
    $("pq-num").textContent = `QUESTION ${game.q + 1} / ${game.total}`;
    $("pq-text").textContent = item.q;
    $("pq-image").hidden = !item.image;
    if (item.image) $("pq-image").src = item.image;
    else $("pq-image").removeAttribute("src");
    $("player-options").dataset.type = item.type;
    $("answer-message").textContent = "";
    $("player-options").innerHTML = item.options.map((option, i) => `<button class="answer-tile color-${i}" data-answer="${i}"><span>${["◆", "●", "▲", "■"][i]}</span>${esc(option)}</button>`).join("");
    const tick = () => {
      const left = Math.max(0, Math.ceil((game.qStart + item.time * 1000 - Date.now()) / 1000));
      $("p-timer").textContent = left;
      if (!left) document.querySelectorAll("[data-answer]").forEach(button => button.disabled = true);
    };
    tick();
    timer = setInterval(tick, 250);
    return show("question");
  }
  if (game.state === "reveal") {
    const ok = me?.last > 0;
    $("result-title").textContent = ok ? "정답이에요! 🎉" : "아쉬워요, 다음 문제!";
    $("result-points").textContent = `+${me?.last || 0}점`;
    $("result-answer").textContent = `정답: ${game.reveal?.text || ""}`;
    $("result-total").textContent = `총점 ${me?.score || 0}점 · ${rankOf(game)}등`;
    return show("result");
  }
  if (game.state === "end") {
    $("end-rank").textContent = `${rankOf(game)}등`;
    $("end-score").textContent = `${me?.score || 0}점`;
    return show("end");
  }
}
$("player-options").addEventListener("click", async event => {
  const button = event.target.closest("[data-answer]");
  if (!button || !currentGame || currentGame.state !== "question") return;
  document.querySelectorAll("[data-answer]").forEach(item => item.disabled = true);
  try {
    await set(at(`games/${pin}/answers/${currentGame.q}/${pid}`), { a: Number(button.dataset.answer), t: serverTimestamp() });
    if (currentGame.state === "question") show("sent");
  } catch (error) {
    console.error(error);
    $("answer-message").textContent = "제출하지 못했어요. 다시 선택해 주세요.";
    document.querySelectorAll("[data-answer]").forEach(item => item.disabled = false);
  }
});
