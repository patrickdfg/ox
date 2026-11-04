import { rankPlayers } from "./game-math.mjs";

const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const rankHtml = players => {
  const ranked = rankPlayers(players);
  return ranked.map(p => `<li value="${p.rank}"><span>${["", "🥇", "🥈", "🥉"][p.rank] || ""} ${ranked.filter(other => other.rank === p.rank).length > 1 ? "공동 " : ""}${p.rank}위 ${esc(p.name)}</span><b>${p.score || 0}점</b></li>`).join("");
};

const podiumScenes = new WeakMap();
export function podium(container, players) {
  podiumScenes.get(container)?.dispose?.();
  const scene = {};
  podiumScenes.set(container, scene);
  const ranked = rankPlayers(players);
  container.innerHTML = ranked.filter(p => p.rank <= 3).map(p => `<article class="podium-place place-${p.rank}"><span aria-label="${p.rank}위">${["", "🥇", "🥈", "🥉"][p.rank]}</span><strong>${esc(p.name)}</strong><b>${p.score || 0}점</b><small>${ranked.filter(other => other.rank === p.rank).length > 1 ? "공동 " : ""}${p.rank}위</small></article>`).join("");
  container.classList.remove("celebrating");
  requestAnimationFrame(() => container.classList.add("celebrating"));
  celebrate();
  if (ranked.length) import("./podium-3d.js").then(({ showPodium }) => {
    if (podiumScenes.get(container) === scene) scene.dispose = showPodium(container, ranked, () => podium(container, players));
  }).catch(error => console.warn("3D 시상대를 표시하지 못해 기본 결과를 사용합니다.", error));
}

export function updateClock(element, leftMs, limitSec) {
  const left = Math.max(0, leftMs);
  element.textContent = Math.ceil(left / 1000);
  element.style.setProperty("--remaining", `${Math.min(100, left / (limitSec * 10))}%`);
  element.setAttribute("aria-label", `남은 시간 ${Math.ceil(left / 1000)}초`);
  const bar = element.closest("section")?.querySelector(".time-progress");
  if (bar) {
    bar.style.setProperty("--remaining", `${Math.min(100, left / (limitSec * 10))}%`);
    bar.setAttribute("aria-valuenow", String(Math.ceil(left / 1000)));
    bar.setAttribute("aria-valuemax", String(limitSec));
  }
}

let audio;
let muted = localStorage.getItem("quiz-play-muted") !== "false";
const enableAudio = () => {
  if (muted) return;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  audio.resume();
};
document.addEventListener("pointerdown", enableAudio, { once: true });
document.addEventListener("keydown", enableAudio, { once: true });
const button = document.createElement("button");
button.type = "button";
button.className = "sound-toggle";
const sync = () => { button.textContent = muted ? "🔇" : "🔊"; button.setAttribute("aria-label", muted ? "축하 효과음 켜기" : "축하 효과음 끄기"); button.setAttribute("aria-pressed", String(!muted)); };
sync();
document.querySelector(".game-top .top-right, .game-top")?.append(button);
button.onclick = () => {
  muted = !muted;
  localStorage.setItem("quiz-play-muted", String(muted));
  enableAudio();
  sync();
};
export function celebrate() {
  if (muted || !audio) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    const start = audio.currentTime + i * .13;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.06, start);
    gain.gain.exponentialRampToValueAtTime(.001, start + .35);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start); oscillator.stop(start + .35);
  });
}
