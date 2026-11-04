import { at, set, get, onValue, serverTimestamp, now, calcPoints, esc } from "./db.js";
import { renderRace } from "./race.js";
import { participant, findSession, startPersonalQuestion } from "./session.js";
import { podium, updateClock } from "./game-effects.js";
const $ = id => document.getElementById(id);
const show = name => ["solo-loading", "join", "wait", "question", "sent", "result", "end"].forEach(s => $(s).hidden = s !== name);
let pin="",pid="",room="",lastKey="",timer=null,currentGame=null,stop=null,personalQ=0,busy=false;
const params = new URLSearchParams(location.search);
const directSolo = params.get("solo") === "1";
if(directSolo) show("solo-loading");
if(params.get("pin")) $("pin-input").value=params.get("pin");
$("join-form").onsubmit=async event=> {
  event.preventDefault();
  const inputPin=$("pin-input").value.trim(), name=$("name-input").value.trim();
  $("join-msg").textContent="";
  if(!/^\d{6}$/.test(inputPin)) return $("join-msg").textContent="PIN 6자리 숫자를 입력하세요.";
  if(!name) return $("join-msg").textContent="닉네임을 입력하세요.";
  try {
    const user=await participant(), found=await findSession(inputPin);
    if(!found) throw new Error("방을 찾을 수 없어요. PIN을 확인하세요.");
    if(!found.secure) throw new Error("이전 버전 방이에요. 진행자가 새 방을 열어 주세요.");
    if(directSolo && (found.game.mode!=="self" || found.game.solo!==true || found.game.owner!==user.uid)) throw new Error("이 자율 학습을 열 수 없어요. 처음부터 다시 시작해 주세요.");
    if(found.game.state==="end") throw new Error("이미 끝난 게임이에요.");
    pin=inputPin;pid=user.uid;room=found.path;
    if(!found.game.players?.[pid]) await set(at(`${room}/players/${pid}`),{name:name.slice(0,12),score:0,last:0});
    sessionStorage.setItem(`quiz-play-${pin}`,pid);sessionStorage.setItem(`quiz-name-${pin}`,name);
    $("me").textContent=found.game.players?.[pid]?.name||name;
    stop?.();lastKey="";stop=onValue(at(room),snapshot=>{render(snapshot.val()||{}).catch(report);},report);
  } catch(error) { if(directSolo) { console.error(error); $("solo-loading-message").textContent="학습을 시작하지 못했어요. 인터넷 연결과 로그인 상태를 확인해 주세요."; } else $("join-msg").textContent=error.message; }
};
function report(error) {console.error(error);$("answer-message").textContent="연결을 확인한 뒤 다시 시도해 주세요.";}
function rankOf(game) {const mine=game.players?.[pid]?.score||0;return Object.values(game.players||{}).filter(p=>p.score>mine).length+1;}
function displayQuestion(item,index,total,started,onTimeout) {
  $("question-progress").value=index+1;$("question-progress").max=total;
  $("pq-num").textContent=`QUESTION ${index+1} / ${total}`;$("pq-text").textContent=item.q;$("pq-image").hidden=!item.image;
  if(item.image) $("pq-image").src=item.image;else $("pq-image").removeAttribute("src");
  $("player-options").dataset.type=item.type;$("answer-message").textContent="";
  $("player-options").innerHTML=item.options.map((option,i)=>`<button class="answer-tile color-${i}" data-answer="${i}"><span>${["◆","●","▲","■"][i]}</span>${esc(option)}</button>`).join("");
  const tick=()=> {
    const left=started+item.time*1000-now();updateClock($("p-timer"),left,item.time);
    if(left<=0) {document.querySelectorAll("[data-answer]").forEach(b=>b.disabled=true);clearInterval(timer);onTimeout?.();}
  };
  clearInterval(timer);show("question");timer=setInterval(tick,100);tick();
}
async function render(game) {
  currentGame=game;renderRace($("race-panel"),game);
  if(!game.state) {clearInterval(timer);if(directSolo){show("solo-loading");$("solo-loading-message").textContent="학습이 종료되었어요. 처음부터 다시 시작해 주세요.";}else{show("join");$("join-msg").textContent="삭제된 방이에요.";}return;}
  if(["cosmic","sunset","ocean"].includes(game.theme)) document.body.className=`game theme-${game.theme}`;
  if(game.mode==="self") return renderPersonal(game);
  const key=`${game.state}-${game.q}`;$("player-rank").textContent=`🏆 ${rankOf(game)}위`;
  if(key===lastKey) return;lastKey=key;clearInterval(timer);
  const me=game.players?.[pid];$("personal-next").hidden=true;
  if(game.state==="lobby") return show("wait");
  if(game.state==="question") {
    if(game.answers?.[game.q]?.[pid]) return show("sent");
    displayQuestion(game.current,game.q,game.total,game.qStart);return;
  }
  if(game.state==="reveal") {
    $("result-title").textContent=me?.last>0?"정답이에요! 🎉":"아쉬워요, 다음 문제!";
    $("result-points").textContent=`+${me?.last||0}점`;$("result-answer").textContent=`정답: ${game.reveal?.text||""}`;
    $("result-exp").textContent=game.reveal?.exp||"";$("result-total").textContent=`총점 ${me?.score||0}점 · ${rankOf(game)}등`;return show("result");
  }
  if(game.state==="end") {
    podium($("podium"),Object.values(game.players||{}));$("end-rank").textContent=`${rankOf(game)}등`;$("end-score").textContent=`${me?.score||0}점`;return show("end");
  }
}
async function renderPersonal(game) {
  const questions=game.questions||[];
  let index=0;while(index<questions.length&&game.answers?.[index]?.[pid]) index++;
  personalQ=index;
  const key=`self-${game.state}-${index}`;if(key===lastKey) return;
  lastKey=key;clearInterval(timer);
  if(game.state==="end"||index===questions.length) {
    const rows=await personalRows(game);$("end-rank").textContent="학습 완료";$("end-score").textContent=`${rows.reduce((sum,r)=>sum+r.points,0)}점`;
    $("personal-review").innerHTML=rows.filter(r=>!r.correct).map(r=>`<article class="glass-panel"><h3>${esc(r.q)}</h3><p>정답: ${esc(r.text)}</p><p>${esc(r.exp)}</p></article>`).join("")||"오답이 없어요!";
    show("end");return;
  }
  const started=await startPersonalQuestion(pin,pid,index);
  if(currentGame?.state==="end"||personalQ!==index) return;
  $("player-rank").textContent="자율 학습";
  displayQuestion(questions[index],index,questions.length,started,()=>submit(-1).catch(report));
}
async function personalRows(game) {
  const rows=[];
  for(let i=0;i<(game.questions||[]).length;i++) {
    const response=game.answers?.[i]?.[pid];if(!response) continue;
    const key=(await get(at(`sessionKeys/${pin}/questions/${i}`))).val();
    const elapsed=Math.max(0,response.t-game.starts[pid][i].t),correct=response.a===key.answer&&elapsed<=game.questions[i].time*1000;
    rows.push({...key,q:game.questions[i].q,correct,points:correct?calcPoints(true,elapsed,game.questions[i].time):0});
  }return rows;
}
async function submit(answer) {
  if(busy||!currentGame||currentGame.state!=="question") return;
  busy=true;const personal=currentGame.mode==="self",q=personal?personalQ:currentGame.q;
  document.querySelectorAll("[data-answer]").forEach(b=>b.disabled=true);
  // 답을 제출한 다음 문제는 학생이 명시적으로 진행할 때 시작합니다.
  if(personal) lastKey=`self-question-${q+1}`;
  try {
    await set(at(`${room}/answers/${q}/${pid}`),{a:answer,t:serverTimestamp()});clearInterval(timer);
    if(personal) {
      const key=(await get(at(`sessionKeys/${pin}/questions/${q}`))).val();
      const game=(await get(at(room))).val(),response=game.answers[q][pid],elapsed=Math.max(0,response.t-game.starts[pid][q].t);
      const ok=answer===key.answer&&elapsed<=game.questions[q].time*1000;
      $("result-title").textContent=ok?"정답이에요! 🎉":"정답과 해설을 확인해요";
      $("result-points").textContent=`+${ok?calcPoints(true,elapsed,game.questions[q].time):0}점`;$("result-answer").textContent=`정답: ${key.text}`;$("result-exp").textContent=key.exp;$("result-total").textContent=`${q+1} / ${game.total}문제 완료`;
      $("personal-next").hidden=false;show("result");
    } else if(currentGame.state==="question") show("sent");
  } catch(error) {lastKey="";report(error);document.querySelectorAll("[data-answer]").forEach(b=>b.disabled=false);}
  finally {busy=false;}
}
$("player-options").onclick=event=> {const button=event.target.closest("[data-answer]");if(button) submit(Number(button.dataset.answer)).catch(report);};
$("personal-next").onclick=()=>{lastKey="";render(currentGame).catch(report);};
if(params.get("pin")&&(directSolo||sessionStorage.getItem(`quiz-name-${params.get("pin")}`))) {
  $("name-input").value=directSolo?"나":sessionStorage.getItem(`quiz-name-${params.get("pin")}`);$("join-form").requestSubmit();
}
else if(directSolo) $("solo-loading-message").textContent="학습을 찾지 못했어요. 처음부터 다시 시작해 주세요.";
