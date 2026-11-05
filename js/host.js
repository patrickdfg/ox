import { at, set, update, get, onValue, serverTimestamp, now, calcPoints, esc } from "./db.js";
import { loadQuiz, sampleQuiz } from "./store.js";
import { auth, authReady } from "./auth.js";
import qrcode from "https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/dist/qrcode.mjs";

import {grade} from './grading.js';
import { renderRace } from "./race.js";
import { participant, saveKeys } from "./session.js";
import { buildReport } from "./reports.mjs";
import { rankHtml, podium, updateClock } from "./game-effects.js";

const $ = id => document.getElementById(id);
const show = name => ["solo-preparing", "lobby", "question", "reveal", "end"].forEach(s => $(s).hidden = s !== name);
const quizId = new URLSearchParams(location.search).get("quiz") || "sample";
const mode = ["self","battle"].includes(new URLSearchParams(location.search).get("mode")) ? new URLSearchParams(location.search).get("mode") : "live";
const directSelf = mode === "self" && new URLSearchParams(location.search).get("direct") === "1";
const settings=new URLSearchParams(location.search),feedback=settings.get('feedback')==='end'?'end':'each',visual=settings.get('visual')==='race'||mode==='battle'?'race':'classic';
let quiz, owner;
let pin = "", game = {}, qIndex = -1, timer = null, revealing = false;
const players = () => Object.entries(game.players || {}).map(([id, player]) => ({ id, ...player }));
const ranking = () => players().sort((a, b) => b.score - a.score);


async function createRoom() {
  if (directSelf) show("solo-preparing");
  owner = (await participant()).uid;
  if (quizId === "sample") quiz = sampleQuiz();
  else {
    await authReady;
    if (auth.currentUser) quiz = await loadQuiz(auth.currentUser.uid, quizId);
  }
  if (!quiz) {
    if (directSelf) {
      $("solo-preparing-message").textContent = "퀴즈를 찾지 못했어요. 저장한 Google 계정으로 로그인해 주세요.";
      return;
    }
    show("lobby");
    $("pin").textContent = "퀴즈 없음";
    $("game-error").textContent = "퀴즈를 찾을 수 없어요. 저장한 Google 계정으로 로그인해 주세요.";
    return;
  }
  document.body.className = `game host-screen theme-${quiz.theme}`;
  $("game-title").textContent = quiz.title;
  const sessionKey = directSelf ? (feedback==='each'&&visual==='classic'?`quiz-solo-${quizId}`:`quiz-solo-${quizId}-${feedback}-${visual}`) : `quiz-host-${quizId}-${mode}`;
  const saved = sessionStorage.getItem(sessionKey);
  const existing = saved ? (await get(at(`sessions/${saved}`))).val() : null;
  const completed = directSelf && existing?.total && Array.from({ length: existing.total }, (_, i) => existing.answers?.[i]?.[owner]).every(Boolean);
  if (existing?.owner === owner && existing.state !== "end" && !completed) {
    pin = saved;
    quiz = (await get(at(`reports/${owner}/${pin}/quiz`))).val() || quiz;
  }
  else {
  let available = false;
  for (let attempt = 0; attempt < 20 && !available; attempt++) {
    pin = String(Math.floor(100000 + Math.random() * 900000));
    try { available = !(await get(at(`sessions/${pin}`))).exists(); }
    catch (error) { if (error.code !== "PERMISSION_DENIED" || attempt === 19) throw error; }
  }
  if (!available) throw new Error("방을 만들지 못했어요. 다시 시도해 주세요.");
  await set(at(`sessions/${pin}`), { owner, mode, feedback,visual, ...(directSelf ? { solo: true } : {}), questions: mode === "self" ? quiz.questions.map(({answer,exp,...item})=>item) : null, state: mode === "self" ? "question" : "lobby", q: -1, title: quiz.title, theme: quiz.theme, total: quiz.questions.length, createdAt: serverTimestamp() });
  await saveKeys(pin, quiz, owner);
  sessionStorage.setItem(sessionKey,pin);
  await persist();
  }
  if (directSelf) {
    location.replace(`play.html?pin=${encodeURIComponent(pin)}&solo=1`);
    return;
  }
  if(mode === "self") { $("start-btn").textContent="학습 종료 · 결과 저장"; $("self-note").hidden=false; }
  const playUrl = new URL("play.html", location.href).href;
  $("pin").textContent = pin;
  $("join-url").textContent = playUrl.replace(/^https?:\/\//, "");
  const qr = qrcode(0, "M");
  qr.addData(`${playUrl}?pin=${pin}`);
  qr.make();
  $("qr").innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
  $("total-q").textContent = quiz.questions.length;
  show("lobby");
  onValue(at(`sessions/${pin}`), snapshot => {
    game = snapshot.val() || {};
    renderRace($("race-panel"),game);
    const list = players();
    $("player-count").textContent = list.length;
    $("player-list").innerHTML = list.map(p => `<li>${esc(p.name)}</li>`).join("");
    $("start-btn").disabled = mode !== "self" && list.length === 0;
    if (mode !== "self" && game.state === "question") {
      const answered = Object.keys(game.answers?.[qIndex] || {}).length;
      $("answer-count").textContent = `${answered} / ${list.length}명 응답`;
      if (list.length && answered >= list.length) reveal().catch(report);
    }
  });
  if(existing?.owner === owner && existing.state !== "end" && mode !== "self") {
    if(existing.state === "grading") {qIndex=existing.q;revealing=false;await reveal();}
    else if(existing.state === "question") await goQuestion(existing.q, true);
    else if(existing.state === "reveal") { qIndex=existing.q; revealing=false; await reveal(); }
  }
}
async function persist() {
  const saved=(await get(at(`sessions/${pin}`))).val();
  if(!saved)return;
  const initialized=(await get(at(`reports/${owner}/${pin}/quiz`))).exists();
  if(initialized)await grade(pin);
  else await set(at(`reports/${owner}/${pin}`), {...buildReport(quiz,saved),quiz});
}
async function goQuestion(i, resume = false) {
  qIndex = i;
  revealing = false;
  const item = quiz.questions[i];
  $("question-progress").value = i + 1;
  $("question-progress").max = quiz.questions.length;
  $("q-num").textContent = `QUESTION ${i + 1} / ${quiz.questions.length}`;
  $("q-text").textContent = item.q;
  $("q-image").hidden = !item.image;
  if (item.image) $("q-image").src = item.image;
  else $("q-image").removeAttribute("src");
  $("host-options").innerHTML = item.options.map((option, j) => `<div class="answer-tile color-${j}"><span>${["◆", "●", "▲", "■"][j]}</span>${esc(option)}</div>`).join("");
  $("answer-count").textContent = `0 / ${players().length}명 응답`;
  show("question");
  if(!resume) await update(at(`sessions/${pin}`), { [`questionStarts/${i}`]: serverTimestamp(), state: "question", q: i, current: { q: item.q, options: item.options, time: item.time, type: item.type, image: item.image || "" }, qStart: serverTimestamp(), reveal: null });
  const started = (await get(at(`sessions/${pin}/qStart`))).val();
  const tick = () => {
    const left = started + item.time * 1000 - now();
    updateClock($("timer"), left, item.time);
    if (left <= 0) reveal().catch(report);
  };
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 100);
}
async function reveal() {
  if (revealing) return;
  revealing = true;
  clearInterval(timer);
  let result;
  try {result=await grade(pin,'reveal');}
  catch(error){revealing=false;throw error;}
  const item=quiz.questions[qIndex],counts=result.counts;
  const scored=Object.values(result.players);
  $("r-answer").textContent = item.options[item.answer];
  $("answer-stats").innerHTML = item.options.map((option, i) => `<div class="answer-tile color-${i} ${i === item.answer ? "correct" : ""}"><span>${esc(option)}</span><b>${counts[i]}명</b></div>`).join("");
  $("r-exp").textContent = item.exp || "";
  $("top5").innerHTML = rankHtml(scored.sort((a, b) => b.score - a.score).slice(0, 5));
  $("next-btn").textContent = qIndex + 1 < quiz.questions.length ? "다음 문제 →" : "최종 결과 보기 🏆";
  show("reveal");
}
async function finish() {
  await update(at(`sessions/${pin}`), { state: "end" });
  await persist();
  if(mode === "self") {
    const final = (await get(at(`reports/${owner}/${pin}`))).val();
    const list=players().map(p=>({...p,score:(final.rows||[]).filter(row=>row.uid===p.id).reduce((sum,row)=>sum+row.points,0)}));
    $("final-rank").innerHTML=rankHtml(list); podium($("podium"),list); show("end"); return;
  }
  $("final-rank").innerHTML = rankHtml(ranking());
  podium($("podium"), ranking());
  show("end");
}
function report(error) { console.error(error); $("game-error").textContent = "연결에 문제가 생겼어요. 인터넷과 Firebase 설정을 확인해 주세요."; }
$("start-btn").onclick = () => (mode === "self" ? finish() : goQuestion(0)).catch(report);
$("skip-btn").onclick = () => reveal().catch(report);
$("next-btn").onclick = () => (qIndex + 1 < quiz.questions.length ? goQuestion(qIndex + 1) : finish()).catch(report);
createRoom().catch(error => {
  if (directSelf) { console.error(error); show("solo-preparing"); $("solo-preparing-message").textContent = "학습을 시작하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요."; return; }
  show("lobby"); $("pin").textContent = "연결 실패"; report(error);
});

const fsButton = $("fs-btn");
const toggleFullscreen = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
};
fsButton.onclick = toggleFullscreen;
if (!document.documentElement.requestFullscreen) fsButton.hidden = true;
document.addEventListener("fullscreenchange", () => document.body.classList.toggle("is-fullscreen", Boolean(document.fullscreenElement)));
document.addEventListener("keydown", event => { if ((event.key === "f" || event.key === "F") && !event.ctrlKey && !event.metaKey && !event.altKey) toggleFullscreen(); });
