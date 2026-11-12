// 게임 모드별 오리지널 배경음악과 음량·음소거·재생 상태를 관리합니다.
import { setEffectsVolume } from "./game-effects.js";

const tracks = {
  live: new URL("../assets/music/classroom.mp3", import.meta.url).href,
  battle: new URL("../assets/music/battle.mp3", import.meta.url).href,
  self: new URL("../assets/music/challenge.mp3", import.meta.url).href
};

export function initGameAudio(initialMode = null) {
  const player = new Audio();
  player.loop = true;
  player.preload = "none";
  let mode = initialMode;
  let stage = "";
  let muted = localStorage.getItem("quiz-play-music-muted") === "true";
  let volume = Number(localStorage.getItem("quiz-play-music-volume") ?? "0.3");
  volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0.3;
  let currentSource = "";

  const controls = document.createElement("div");
  controls.className = "game-audio-controls";
  controls.innerHTML = `<button type="button" class="music-toggle" aria-label="배경음악 끄기" title="배경음악 끄기">🎵</button><details class="music-settings"><summary aria-label="배경음악과 효과음 음량 조절" title="소리 설정">🎚️</summary><div class="music-settings-panel"><label>배경음악 <input class="music-volume" type="range" min="0" max="100" step="1" value="${Math.round(volume * 100)}" aria-label="배경음악 음량"></label><label>효과음 <input class="effects-volume" type="range" min="0" max="100" step="1" value="${Math.round(Number(localStorage.getItem("quiz-play-fx-volume") ?? "0.55") * 100)}" aria-label="효과음 음량"></label><small>🔊 버튼으로 효과음을 끌 수 있습니다.</small></div></details>`;
  document.querySelector(".game-top .top-right, .game-top")?.append(controls);
  const toggle = controls.querySelector(".music-toggle");
  const slider = controls.querySelector(".music-volume");
  const effects = controls.querySelector(".effects-volume");
  const sync = () => {
    toggle.textContent = muted ? "🔇" : "🎵";
    toggle.setAttribute("aria-label", muted ? "배경음악 켜기" : "배경음악 끄기");
    toggle.setAttribute("title", muted ? "배경음악 켜기" : "배경음악 끄기");
    toggle.setAttribute("aria-pressed", String(!muted));
  };
  const update = () => {
    const url = tracks[mode];
    if (stage !== "question" || !url || muted || document.hidden) {
      player.pause();
      if (stage === "end") player.currentTime = 0;
      return;
    }
    if (currentSource !== url) {
      player.pause();
      currentSource = url;
      player.src = url;
      player.currentTime = 0;
    }
    player.volume = volume;
    if (player.paused) player.play().catch(() => {});
  };
  toggle.onclick = () => {
    muted = !muted;
    localStorage.setItem("quiz-play-music-muted", String(muted));
    sync();
    update();
  };
  slider.oninput = () => {
    volume = Number(slider.value) / 100;
    localStorage.setItem("quiz-play-music-volume", String(volume));
    player.volume = volume;
    if (volume > 0 && !muted) update();
  };
  effects.oninput = () => setEffectsVolume(Number(effects.value) / 100);
  document.addEventListener("visibilitychange", update);
  document.addEventListener("pointerdown", () => {
    if (stage === "question" && !muted && player.paused) update();
  });
  window.addEventListener("pagehide", () => player.pause());
  sync();
  return {
    setMode(nextMode) { if (mode === nextMode) return; mode = nextMode; update(); },
    setStage(nextStage) { if (stage === nextStage) return; stage = nextStage; update(); },
    pause() { player.pause(); }
  };
}
