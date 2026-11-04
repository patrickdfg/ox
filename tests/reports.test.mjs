import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, summarize, reportCsv } from '../js/reports.mjs';
const quiz={title:'검증',questions:[{q:'문제',options:['O','X'],answer:0,time:20,exp:'해설'}]};
test('수업 결과는 원래 채점 공식으로 학생·문제 분석을 만든다',()=>{
 const r=buildReport(quiz,{createdAt:1,players:{a:{name:'학생'}},questionStarts:{0:1000},answers:{0:{a:{a:0,t:11000}}}});
 assert.equal(r.rows[0].points,750);assert.equal(r.rows[0].elapsedMs,10000);
 assert.equal(summarize(r.rows,'q')[0].accuracy,100);
});
test('자율 학습 미응답과 제한시간 초과는 오답이다',()=>{
 const r=buildReport(quiz,{mode:'self',players:{a:{name:'학생'},b:{name:'미응답'}},starts:{a:{0:{t:1000,q:0}}},answers:{0:{a:{a:0,t:22000}}}});
 assert.deepEqual(r.rows.map(r=>r.correct),[false,false]);assert.equal(r.rows[1].elapsedMs,null);
});
test('CSV는 한글·쉼표·따옴표와 수식 삽입을 안전하게 처리한다',()=>{
 const r=buildReport(quiz,{players:{a:{name:'=HYPERLINK("x")'}}});
 const csv=reportCsv(r);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
});
