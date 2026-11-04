import { at, get, remove, esc } from "./db.js";
import { auth, watchAuth, login, logout } from "./auth.js";
import { buildReport, summarize, reportCsv } from "./reports.mjs";
const $ = id => document.getElementById(id);
let reports={}, selected;
$("login").onclick=()=> (auth.currentUser && !auth.currentUser.isAnonymous ? logout() : login()).catch(reportError);
function reportError(error) { console.error(error); $("report-status").textContent="결과를 불러오지 못했어요. 로그인과 연결을 확인하세요."; }
watchAuth(async user=> {
  $("report-detail").hidden=true;
  $("report-list").innerHTML="";
  $("login").textContent=user && !user.isAnonymous ? "로그아웃" : "Google 로그인";
  if(!user) {$("report-status").textContent="교사 Google 계정으로 로그인해 주세요.";return;}
  try {
    reports=(await get(at(`reports/${user.uid}`))).val()||{};
    $("report-status").textContent=Object.keys(reports).length ? "결과를 선택하세요. 자율진행 결과는 열 때 최신 응답으로 갱신합니다." : "저장된 결과가 없어요.";
    $("report-list").innerHTML=Object.entries(reports).map(([id,r])=>`<article class="glass-panel"><h2>${esc(r.title)}</h2><p>${esc(r.mode)} · ${new Date(r.createdAt).toLocaleString()}</p><button data-open="${esc(id)}">결과 보기</button> <button data-delete="${esc(id)}">결과 삭제</button></article>`).join("");
  } catch(error) {reportError(error);}
});
const table = rows => `<table><thead><tr><th scope="col">항목</th><th scope="col">정답률</th><th scope="col">평균 응답 시간</th><th scope="col">점수</th></tr></thead><tbody>${rows.map(r=>`<tr><th scope="row">${esc(r.name)}</th><td>${r.correct}/${r.total} (${r.accuracy}%)</td><td>${r.meanMs===null?"미응답":(r.meanMs/1000).toFixed(2)+"초"}</td><td>${r.score}</td></tr>`).join("")}</tbody></table>`;
$("report-list").onclick=async event=> {
  const user=auth.currentUser,id=event.target.dataset.open||event.target.dataset.delete;
  if(!id||!user) return;
  try {
    if(event.target.dataset.delete) {
      if(!confirm("이 결과와 해당 게임의 학생 응답을 삭제할까요?")) return;
      if(reports[id].classCode && reports[id].assignmentId) await remove(at(`classes/${reports[id].classCode}/assignments/${reports[id].assignmentId}`));
      await remove(at(`sessionKeys/${id}`)); await remove(at(`sessions/${id}`)); await remove(at(`reports/${user.uid}/${id}`));
      event.target.closest("article").remove(); $("report-detail").hidden=true; return;
    }
    selected=reports[id];
    if(selected.mode==="self") {
      const game=(await get(at(`sessions/${id}`))).val();
      if(game) selected=buildReport(selected.quiz,game);
    }
    $("report-title").textContent=selected.title;
    $("student-stats").innerHTML=table(summarize(selected.rows||[],"uid"));
    $("question-stats").innerHTML=table(summarize(selected.rows||[],"q"));
    $("review-student").innerHTML='<option value="">모든 학생</option>'+summarize(selected.rows||[],"uid").map(r=>`<option value="${esc(r.key)}">${esc(r.name)}</option>`).join("");
    review(); $("report-detail").hidden=false;
  } catch(error) {reportError(error);}
};
function review() {
  const uid=$("review-student").value;
  const rows=(selected.rows||[]).filter(r=>!r.correct&&(!uid||r.uid===uid));
  $("wrong-review").innerHTML=rows.map(r=>`<article class="glass-panel"><h4>${esc(r.name)} · ${r.q}. ${esc(r.question)}</h4><p>내 답: ${esc(r.selected)} / 정답: ${esc(r.answer)}</p><p>${esc(r.exp)}</p></article>`).join("")||"오답이 없어요!";
}
$("review-student").onchange=review;
$("csv").onclick=()=> {
  const url=URL.createObjectURL(new Blob([reportCsv(selected)],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a"); a.href=url; a.download="quiz-report.csv"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
};
