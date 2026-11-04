import { at, get, set, update, remove, serverTimestamp, esc } from "./db.js";
import { auth, watchAuth, login, logout } from "./auth.js";
import { participant, saveKeys } from "./session.js";
import { loadQuizzes, sampleQuiz } from "./store.js";
import { buildReport, summarize } from "./reports.mjs";
const $=id=>document.getElementById(id);
let code="",quizzes=[],current=null,request=0;
const teacher=user=>user&&!user.isAnonymous;
const fail=error=>{console.error(error);$("class-status").textContent="처리하지 못했어요. 로그인·클래스 코드·연결을 확인해 주세요.";};
$("account").onclick=()=> (teacher(auth.currentUser)?logout():login()).catch(fail);
watchAuth(async user=>{
  const revision=++request;current=null;$("class-detail").hidden=true;$("class-list").innerHTML="";
  $("account").textContent=teacher(user)?"교사 로그아웃":"교사 Google 로그인";
  $("create-button").disabled=!teacher(user);
  if(!teacher(user)) return;
  try {
    quizzes=[sampleQuiz(),...await loadQuizzes(user.uid)];
    const owned=(await get(at(`teacherClasses/${user.uid}`))).val()||{};
    const cards=[];
    for(const id of Object.keys(owned)) {
      const data=(await get(at(`classes/${id}/meta`))).val();
      if(data) cards.push(`<article class="glass-panel"><h3>${esc(data.title)}</h3><p>코드 ${esc(id)}</p><button data-class="${esc(id)}">클래스 열기</button></article>`);
    }
    if(revision!==request)return;
    $("class-list").innerHTML=cards.join('')||"아직 만든 클래스가 없어요.";
  } catch(error){fail(error);}
});
$("create-class").onsubmit=async event=>{
  event.preventDefault();const user=auth.currentUser;if(!teacher(user))return;
  try {
    let id;do{id=crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();}while((await get(at(`classes/${id}/meta`))).exists());
    await set(at(`classes/${id}`),{owner:user.uid,meta:{title:$("class-title").value.trim(),createdAt:serverTimestamp()}});
    await set(at(`teacherClasses/${user.uid}/${id}`),true);
    $("class-status").textContent="클래스를 만들었어요. 학생에게 코드를 알려 주세요.";
    if(!$("class-list").querySelector('article'))$("class-list").innerHTML='';
    $("class-list").insertAdjacentHTML('beforeend',`<article class="glass-panel"><h3>${esc($("class-title").value.trim())}</h3><p>코드 ${id}</p><button data-class="${id}">클래스 열기</button></article>`);
    await openClass(id);
  }catch(error){fail(error);}
};
$("join-class").onsubmit=async event=>{
  event.preventDefault();
  try {
    const user=await participant(),id=$("class-code").value.trim().toUpperCase(),name=$("class-name").value.trim();
    if(!/^[A-F0-9]{8}$/.test(id)||!name) {$("class-status").textContent="클래스 코드 8자리와 닉네임을 확인하세요.";return;}
    const meta=(await get(at(`classes/${id}/meta`))).val();
    if(!meta){$("class-status").textContent="클래스를 찾을 수 없어요.";return;}
    const saved=(await get(at(`classes/${id}/members/${user.uid}`))).val();
    if(!saved)await set(at(`classes/${id}/members/${user.uid}`),{name:name.slice(0,12),joinedAt:serverTimestamp()});
    $("class-status").textContent="참가했어요. 배정된 퀴즈를 시작하세요.";await openClass(id);
  }catch(error){fail(error);}
};
$("class-list").onclick=event=>{if(event.target.dataset.class)openClass(event.target.dataset.class).catch(fail);};
async function openClass(id) {
  const user=auth.currentUser;if(!user)return;
  const meta=(await get(at(`classes/${id}/meta`))).val();if(!meta)throw new Error('deleted');
  code=id;history.replaceState(null,'',`?class=${id}`);
  let owned=false;
  if(teacher(user)) owned=(await get(at(`teacherClasses/${user.uid}/${id}`))).val()===true;
  const member=(await get(at(`classes/${id}/members/${user.uid}`))).val();
  if(!owned&&!member)throw new Error('membership');
  const data=owned?(await get(at(`classes/${id}`))).val():{meta,assignments:(await get(at(`classes/${id}/assignments`))).val()||{}};
  if(code!==id||auth.currentUser?.uid!==user.uid)return;
  current=data;$("class-detail").hidden=false;$("detail-title").textContent=meta.title;
  $("detail-code").textContent=`클래스 코드 ${id}`;$("teacher-controls").hidden=!owned;
  const assignments=Object.entries(data.assignments||{});
  $("class-assignments").innerHTML=assignments.map(([aid,a])=>`<article class="glass-panel"><h4>${esc(a.title)}</h4><a class="btn primary" href="play.html?pin=${encodeURIComponent(a.pin)}">학습 시작</a>${owned?`<button data-remove-assignment="${esc(aid)}">배정·기록 삭제</button>`:''}</article>`).join('')||"배정된 퀴즈가 없어요.";
  if(!owned)return;
  $("assignment-quiz").innerHTML=quizzes.map(q=>`<option value="${esc(q.id)}">${esc(q.title)}</option>`).join('');
  $("class-members").innerHTML=Object.entries(data.members||{}).map(([uid,m])=>`<p>${esc(m.name)} <button data-remove-member="${esc(uid)}">참가·기록 삭제</button></p>`).join('')||"참가 학생이 없어요.";
  const rows=[];
  for(const [,a]of assignments) {
    const saved=(await get(at(`reports/${user.uid}/${a.pin}`))).val();
    const game=(await get(at(`sessions/${a.pin}`))).val();
    if(saved&&game)rows.push(...buildReport(saved.quiz,game).rows);
  }
  if(code!==id)return;
  $("class-history").innerHTML=`<table><thead><tr><th>학생</th><th>누적 정답률</th><th>평균 응답 시간</th><th>누적 점수</th></tr></thead><tbody>${summarize(rows,'uid').map(r=>`<tr><th scope="row">${esc(r.name)}</th><td>${r.correct}/${r.total} (${r.accuracy}%)</td><td>${r.meanMs===null?'미응답':(r.meanMs/1000).toFixed(2)+'초'}</td><td>${r.score}</td></tr>`).join('')}</tbody></table>`;
}
$("assign-quiz").onsubmit=async event=>{
  event.preventDefault();const user=auth.currentUser;if(!user||current?.owner!==user.uid)return;
  const quiz=quizzes.find(q=>q.id===$("assignment-quiz").value);if(!quiz)return;
  const target=code,assignmentId=crypto.randomUUID();
  try {
    let pin;do{pin=String(100000+crypto.getRandomValues(new Uint32Array(1))[0]%900000);}while((await get(at(`sessions/${pin}`))).exists());
    const game={owner:user.uid,mode:'self',classCode:target,assignmentId,state:'question',q:-1,title:quiz.title,theme:quiz.theme,total:quiz.questions.length,createdAt:serverTimestamp(),questions:quiz.questions.map(({answer,exp,...q})=>q)};
    await set(at(`sessions/${pin}`),game);await saveKeys(pin,quiz,user.uid);
    const saved=(await get(at(`sessions/${pin}`))).val();
    await set(at(`reports/${user.uid}/${pin}`),{...buildReport(quiz,saved),quiz});
    await set(at(`classes/${target}/assignments/${assignmentId}`),{title:quiz.title,pin,createdAt:serverTimestamp()});
    $("class-status").textContent="퀴즈를 배정했어요.";await openClass(target);
  }catch(error){fail(error);}
};
async function deleteAssignment(assignmentId) {
  const pin=current.assignments[assignmentId].pin,uid=auth.currentUser.uid;
  await remove(at(`sessionKeys/${pin}`));await remove(at(`sessions/${pin}`));await remove(at(`reports/${uid}/${pin}`));await remove(at(`classes/${code}/assignments/${assignmentId}`));
}
$("class-assignments").onclick=async event=>{
  const id=event.target.dataset.removeAssignment;if(!id||!confirm('이 배정과 학습 기록을 삭제할까요?'))return;
  try{await deleteAssignment(id);await openClass(code);}catch(error){fail(error);}
};
$("class-members").onclick=async event=>{
  const uid=event.target.dataset.removeMember;if(!uid||!confirm('이 학생의 참가 정보와 클래스 학습 기록을 삭제할까요?'))return;
  try {
    for(const a of Object.values(current.assignments||{})) {
      const game=(await get(at(`sessions/${a.pin}`))).val();if(!game)continue;
      const changes={};changes[`players/${uid}`]=null;changes[`starts/${uid}`]=null;
      for(const q of Object.keys(game.answers||{})) changes[`answers/${q}/${uid}`]=null;
      await update(at(`sessions/${a.pin}`),changes);
      const saved=(await get(at(`reports/${auth.currentUser.uid}/${a.pin}`))).val();
      if(saved)await set(at(`reports/${auth.currentUser.uid}/${a.pin}`),{...buildReport(saved.quiz,(await get(at(`sessions/${a.pin}`))).val()),quiz:saved.quiz});
    }
    await remove(at(`classes/${code}/members/${uid}`));await openClass(code);
  }catch(error){fail(error);}
};
$("refresh-class").onclick=()=>openClass(code).catch(fail);
$("delete-class").onclick=async()=>{
  if(!confirm('클래스, 모든 배정과 학습 기록을 삭제할까요? 원래 퀴즈는 유지됩니다.'))return;
  try {
    for(const id of Object.keys(current.assignments||{}))await deleteAssignment(id);
    await remove(at(`classes/${code}`));await remove(at(`teacherClasses/${auth.currentUser.uid}/${code}`));
    $("class-list").querySelector(`[data-class="${code}"]`)?.closest('article').remove();$("class-detail").hidden=true;$("class-status").textContent="클래스와 학습 기록을 삭제했어요.";
  }catch(error){fail(error);}
};
const initial=new URLSearchParams(location.search).get('class');if(initial)$("class-code").value=initial;
