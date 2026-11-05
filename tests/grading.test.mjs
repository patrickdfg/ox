import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/quiz-grade/core.mjs';
const quiz={title:'서버 검증',questions:[{q:'1+1',options:['1','2'],answer:1,time:20,exp:'둘'},{q:'O',options:['O','X'],answer:0,time:20}]};
function setup(mode='live') {
 const game={owner:'teacher',mode,state:'question',q:0,total:2,qStart:1000,questionStarts:{0:1000},createdAt:1000,questions:quiz.questions.map(({answer,exp,...q})=>q),players:{student:{name:'별',score:999999,last:999999}},answers:{0:{student:{a:1,t:6000}}},starts:{student:{0:{t:1000}}}};
 const data={sessions:{123456:game},reports:{teacher:{123456:{quiz}}},sessionKeys:{123456:{owner:'teacher',questions:quiz.questions.map(q=>({answer:q.answer,text:q.options[q.answer],exp:q.exp||''}))}}};
 const read=async p=>structuredClone(p.split('/').reduce((v,k)=>v?.[k],data)??null);
 const write=async(p,v,token,method)=>{const parts=p.split('/');if(method==='PATCH'){for(const[k,value]of Object.entries(v))await write(p+'/'+k,value,token,'PUT');return;}let target=data;for(const k of parts.slice(0,-1))target=target[k]||={};target[parts.at(-1)]=structuredClone(v);};
 const run=createHandler({verify:async token=>token==='invalid'?null:token,read,write});
 const call=(body={},token='teacher',origin='https://patrickdfg.github.io')=>run(new Request('https://test',{method:'POST',headers:{origin,Authorization:'Bearer '+token},body:JSON.stringify({pin:'123456',...body})}));
 return {game,data,call};
}
test('채점 서버는 신원·출처·소유권을 검사한다',async()=>{const {call}=setup();assert.equal((await call({action:'report'},'invalid')).status,401);assert.equal((await call({action:'report'},'student')).status,403);assert.equal((await call({action:'report'},'teacher','https://evil.test')).status,403);assert.equal((await call({pin:'../../secrets',action:'report'})).status,400);});
test('제출을 먼저 닫고 저장된 답·서버 시각으로 계산, 재요청 중복 가산 없음',async()=>{const {call,game,data}=setup();const r=await (await call({action:'reveal',score:500000,time:0})).json();assert.equal(game.state,'reveal');assert.equal(game.players.student.score,875);assert.equal(game.players.student.last,875);assert.deepEqual(r.counts,[0,1]);assert.equal(data.reports.teacher[123456].gradingVersion,1);await call({action:'reveal'});assert.equal(game.players.student.score,875);});
test('개인 채점은 본인의 제출한 문항만 공개하고 시간 초과는 0점',async()=>{const {call,game}=setup('self');assert.equal((await call({action:'personal',q:1},'student')).status,403);assert.equal((await call({action:'personal',q:0},'other')).status,403);const result=await (await call({action:'personal',q:0,answer:0},'student')).json();assert.equal(result.rows[0].points,875);game.answers[0].student.t=25000;assert.equal((await(await call({action:'personal'},'student')).json()).rows[0].points,0);});
test('중간 서버 장애 후 grading 상태에서 안전하게 재개한다',async()=>{const {call,game}=setup();game.state='grading';assert.equal((await call({action:'reveal'})).status,200);assert.equal(game.players.student.score,875);});
test('완료 후 공개 설정은 마지막 제출 전 정답과 점수를 숨긴다',async()=>{const {call,game}=setup('self');game.feedback='end';assert.equal((await call({action:'personal',q:0},'student')).status,403);game.answers[1]={student:{a:0,t:7000}};game.starts.student[1]={t:6000};const r=await call({action:'personal'},'student');assert.equal(r.status,200);assert.equal((await r.json()).rows.length,2);});
test('기존에 저장한 100문제 초과 퀴즈도 리포트를 계산한다',async()=>{const {call,game,data}=setup();data.reports.teacher[123456].quiz={...quiz,questions:Array.from({length:101},()=>quiz.questions[0])};game.total=101;const r=await call({action:'report'});assert.equal(r.status,200);assert.equal((await r.json()).report.distributions.length,101);});
