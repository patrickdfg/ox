// 게임별 배경음악 재생·정지·음량·음소거 및 음원 파일을 검사합니다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const mode of ["challenge", "battle", "classroom"]) {
  test(`${mode} 모드의 오리지널 MP3 파일을 포함한다`, () => {
    const data = readFileSync(new URL(`../assets/music/${mode}.mp3`, import.meta.url));
    assert.ok(data.length > 100000);
    assert.equal(data.subarray(0, 3).toString(), "ID3");
  });
}

test("게임 화면 상태에 따라 모드별 음악이 재생·일시 정지되고 음량을 조절한다", () => {
  const elements = new Map();
  let audio;
  const events = {};
  class MockAudio {
    constructor() { audio = this; this.paused = true; this.src = ""; this.volume = 1; this.currentTime = 0; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const controls = {
    set innerHTML(html) { this.html = html; },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {
        value: selector === ".music-volume" ? "30" : "55",
        textContent: "",
        setAttribute(name, value) { this[name] = value; }
      });
      return elements.get(selector);
    }
  };
  const storage = new Map();
  const localStorage = { getItem: key => storage.has(key) ? storage.get(key) : null, setItem: (key, value) => storage.set(key, value) };
  const document = {
    hidden: false,
    createElement: () => controls,
    querySelector: () => ({ append() {} }),
    addEventListener: (name, callback) => { events[name] = callback; }
  };
  const window = { addEventListener: (name, callback) => { events[name] = callback; } };
  let effectVolume = null;
  const source = readFileSync(new URL("../js/game-audio.js", import.meta.url), "utf8")
    .replace('import { setEffectsVolume } from "./game-effects.js";', "")
    .replaceAll("import.meta.url", '"https://example.test/ox/js/game-audio.js"')
    .replace("export function initGameAudio", "function initGameAudio");
  const initialize = new Function("Audio", "document", "window", "localStorage", "setEffectsVolume", source + "\nreturn initGameAudio;");
  const sound = initialize(MockAudio, document, window, localStorage, value => { effectVolume = value; })("live");

  assert.equal(audio.paused, true);
  sound.setStage("question");
  assert.match(audio.src, /classroom\.mp3$/);
  assert.equal(audio.paused, false);
  sound.setStage("reveal");
  assert.equal(audio.paused, true);
  sound.setStage("question");
  assert.equal(audio.paused, false);
  sound.setMode("battle");
  assert.match(audio.src, /battle\.mp3$/);
  sound.setMode("self");
  assert.match(audio.src, /challenge\.mp3$/);
  elements.get(".music-toggle").onclick();
  assert.equal(audio.paused, true);
  elements.get(".music-toggle").onclick();
  assert.equal(audio.paused, false);
  elements.get(".music-volume").value = "60";
  elements.get(".music-volume").oninput();
  assert.equal(audio.volume, 0.6);
  elements.get(".effects-volume").value = "25";
  elements.get(".effects-volume").oninput();
  assert.equal(effectVolume, 0.25);
  document.hidden = true;
  events.visibilitychange();
  assert.equal(audio.paused, true);
  document.hidden = false;
  events.visibilitychange();
  assert.equal(audio.paused, false);
  sound.setStage("end");
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 0);
  sound.setMode(null);
  sound.setStage("question");
  assert.equal(audio.paused, true);
  events.pagehide();
  assert.equal(audio.paused, true);
});
