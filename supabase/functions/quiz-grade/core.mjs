import {buildReport} from '../../../js/reports.mjs';
import {calcPoints} from '../../../js/game-math.mjs';
const allowed = origin => origin === 'https://patrickdfg.github.io' || /^http:\/\/localhost:\d+$/.test(origin || '');
function analysis(quiz,game){
 const report=buildReport(quiz,game),n=Object.keys(game.players||{}).length;
 return {...report,summary:{participants:n,average:n?report.rows.reduce((s,r)=>s+r.points,0)/n:0,accuracy:report.rows.length?report.rows.filter(r=>r.correct).length/report.rows.length:0},distributions:quiz.questions.map((q,i)=>({question:q.q,options:q.options,counts:q.options.map((_,a)=>Object.values(game.answers?.[i]||{}).filter(r=>r.a===a).length)}))};
}
export function createHandler({verify,read,write}) {
 return async req=>{
  const origin=req.headers.get('origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}:{})};
  const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(!allowed(origin)) return respond({error:'허용되지 않은 출처입니다.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return respond({error:'POST 요청이 필요합니다.'},405);
  const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  let uid;try{uid=token&&await verify(token);}catch{}if(!uid)return respond({error:'다시 로그인해 주세요.'},401);
  try {
   const raw=await req.text();if(raw.length>1024)return respond({error:'요청이 너무 큽니다.'},413);
   const body=JSON.parse(raw),{pin,action}=body;
   if(!/^\d{6}$/.test(pin)||!['reveal','report','personal'].includes(action))return respond({error:'요청을 확인해 주세요.'},400);
   let game=await read(`sessions/${pin}`,token);
   if(!game)return respond({error:'방을 찾을 수 없어요.'},404);
   if(action==='personal') {
    if(game.mode!=='self'||!game.players?.[uid])return respond({error:'참가한 학습만 볼 수 있어요.'},403);
    if(game.feedback==='end'&&game.state!=='end'&&!game.answers?.[game.total-1]?.[uid])return respond({error:'모든 문제를 푼 뒤 정답을 확인할 수 있어요.'},403);
    if(body.q!==undefined&&(!Number.isInteger(body.q)||!game.questions?.[body.q]||!game.answers?.[body.q]?.[uid]))return respond({error:'제출한 문항만 확인할 수 있어요.'},403);
    const indices=body.q===undefined||(game.visual==='race'&&game.feedback!=='end')?Object.keys(game.answers||{}).filter(q=>game.answers[q]?.[uid]).map(Number):[body.q];
    if(indices.some(q=>!Number.isInteger(q)||q<0||!game.questions?.[q]||!game.answers?.[q]?.[uid]))return respond({error:'제출한 문항만 확인할 수 있어요.'},403);
    const rows=await Promise.all(indices.map(async q=>{
     const key=await read(`sessionKeys/${pin}/questions/${q}`,token),a=game.answers[q][uid],start=game.starts?.[uid]?.[q]?.t,item=game.questions[q];
     if(!key||!Number.isFinite(start)||!Number.isFinite(a.t))throw Error('missing-data');
     const elapsed=a.t-start,correct=Number.isInteger(a.a)&&a.a===key.answer&&elapsed>=0&&elapsed<=item.time*1000;
     return {...key,index:q,q:item.q,correct,points:calcPoints(correct,elapsed,item.time),elapsedMs:Math.max(0,elapsed)};
    }));return respond({rows});
   }
   if(game.owner!==uid)return respond({error:'진행자만 채점할 수 있어요.'},403);
   const saved=await read(`reports/${uid}/${pin}`,token),quiz=saved?.quiz;
   if(!quiz?.questions?.length)return respond({error:'저장된 퀴즈를 찾을 수 없어요.'},409);
   if(action==='reveal') {
    if(game.mode==='self'||!['question','grading','reveal'].includes(game.state)||!quiz.questions[game.q])return respond({error:'공개할 문항이 없어요.'},409);
    // Close submissions before taking the grading snapshot. A retry is idempotent.
    if(game.state==='question')await write(`sessions/${pin}`,{state:'grading'},token,'PATCH');
    game=await read(`sessions/${pin}`,token);
    if(!['grading','reveal'].includes(game.state))return respond({error:'게임 단계가 바뀌었어요.'},409);
    const q=game.q,item=quiz.questions[q],r=buildReport(quiz,game),counts=item.options.map(()=>0),changes={state:'reveal',reveal:{answer:item.answer,text:item.options[item.answer],exp:item.exp||''}};
    for(const a of Object.values(game.answers?.[q]||{}))if(Number.isInteger(a.a)&&counts[a.a]!==undefined)counts[a.a]++;
    for(const id of Object.keys(game.players||{})){
     const rows=r.rows.filter(row=>row.uid===id&&row.q<=q+1),score=rows.reduce((sum,row)=>sum+row.points,0),last=rows.find(row=>row.q===q+1)?.points||0;
     changes[`players/${id}/score`]=score;changes[`players/${id}/last`]=last;
    }
    await write(`sessions/${pin}`,changes,token,'PATCH');
    // Re-read the committed state; the browser receives the same scores as students.
    const final=await read(`sessions/${pin}`,token),result={...analysis(quiz,final),quiz,gradedAt:Date.now(),gradingVersion:1};
    await write(`reports/${uid}/${pin}`,result,token,'PUT');
    return respond({counts,report:result,players:final.players||{},reveal:changes.reveal});
   }
   const result={...analysis(quiz,game),quiz,gradedAt:Date.now(),gradingVersion:1};
   await write(`reports/${uid}/${pin}`,result,token,'PUT');return respond({report:result});
  }catch{return respond({error:'서버에서 채점하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'},503);}
 };
}
