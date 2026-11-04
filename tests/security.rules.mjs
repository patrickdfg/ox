import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, set, get, update, remove, serverTimestamp } from 'firebase/database';
let env;
const db=uid=>env.authenticatedContext(uid).database();
before(async()=> {
 env=await initializeTestEnvironment({projectId:'demo-quiz-play',database:{host:'127.0.0.1',port:9000,rules:await readFile(new URL('../database.rules.json',import.meta.url),'utf8')}});
 await env.withSecurityRulesDisabled(async context=>set(ref(context.database()),{
  sessions:{'123456':{owner:'teacher',mode:'live',state:'question',q:0,qStart:Date.now(),createdAt:Date.now(),current:{time:120,options:['O','X']},players:{student:{name:'학생',score:0,last:0}}},
  '234567':{owner:'teacher',mode:'self',state:'question',createdAt:Date.now(),total:2,questions:[{q:'첫 문제',time:120,options:['O','X']},{q:'두 번째',time:120,options:['O','X']}],players:{student:{name:'학생',score:0,last:0}}}},
  sessionKeys:{'234567':{owner:'teacher',questions:[{answer:0,text:'O',exp:'해설'},{answer:1,text:'X',exp:'해설'}]}},
  quizzes:{teacher:{private:{title:'비공개'}}},reports:{teacher:{private:{title:'비공개'}}}
 }));
});
after(async()=>env?.cleanup());
test('미인증·다른 계정은 퀴즈·리포트를 읽거나 쓸 수 없다',async()=>{
 await assertFails(get(ref(db('student'),'quizzes/teacher')));
 await assertFails(get(ref(db('student'),'reports/teacher')));
 await assertFails(get(ref(env.unauthenticatedContext().database(),'sessions/123456')));
 await assertSucceeds(get(ref(db('teacher'),'quizzes/teacher')));
});
test('학생은 자기 닉네임으로만 참가하며 점수·진행·다른 학생 응답을 조작할 수 없다',async()=>{
 const s=db('outsider');
 await assertSucceeds(set(ref(s,'sessions/123456/players/outsider'),{name:'새 학생',score:0,last:0}));
 await assertFails(set(ref(s,'sessions/123456/players/fake'),{name:'위조',score:0,last:0}));
 await assertFails(set(ref(s,'sessions/123456/players/outsider/score'),999999));
 await assertFails(set(ref(s,'sessions/123456/state'),'end'));
 await assertFails(set(ref(s,'sessions/123456/answers/0/student'),{a:0,t:serverTimestamp()}));
 await assertFails(remove(ref(s,'sessions/123456')));
});
test('응답은 현재 문항·정상 보기·서버 시각으로 단 한 번만 저장된다',async()=>{
 const s=db('student');
 await assertFails(set(ref(s,'sessions/123456/answers/1/student'),{a:0,t:serverTimestamp()}));
 await assertFails(set(ref(s,'sessions/123456/answers/0/student'),{a:10,t:serverTimestamp()}));
 await assertFails(set(ref(s,'sessions/123456/answers/0/student'),{a:0,t:1000}));
 await assertSucceeds(set(ref(s,'sessions/123456/answers/0/student'),{a:0,t:serverTimestamp()}));
 await assertFails(set(ref(s,'sessions/123456/answers/0/student'),{a:1,t:serverTimestamp()}));
 await assertFails(remove(ref(s,'sessions/123456/answers/0/student')));
});
test('자율 학습은 문항 순서·타이머를 강제하고 응답 후 자기 정답만 공개한다',async()=>{
 const s=db('student');
 await assertFails(get(ref(s,'sessionKeys/234567/questions/0')));
 await assertFails(set(ref(s,'sessions/234567/starts/student/1'),{q:1,t:serverTimestamp()}));
 await assertSucceeds(set(ref(s,'sessions/234567/starts/student/0'),{q:0,t:serverTimestamp()}));
 await assertFails(set(ref(s,'sessions/234567/starts/student/0'),{q:0,t:serverTimestamp()}));
 await assertSucceeds(set(ref(s,'sessions/234567/answers/0/student'),{a:0,t:serverTimestamp()}));
 await assertSucceeds(get(ref(s,'sessionKeys/234567/questions/0')));
 await assertFails(get(ref(s,'sessionKeys/234567/questions/1')));
 await assertFails(get(ref(db('outsider'),'sessionKeys/234567/questions/0')));
 await assertSucceeds(set(ref(s,'sessions/234567/starts/student/1'),{q:1,t:serverTimestamp()}));
});
test('교사 소유권은 이전할 수 없고 기존 공개 games 쓰기는 닫힌다',async()=>{
 await assertFails(set(ref(db('teacher'),'sessions/123456/owner'),'student'));
 await assertFails(set(ref(db('student'),'games/123456'),{state:'end'}));
 await assertSucceeds(update(ref(db('teacher'),'sessions/123456'),{state:'reveal'}));
});
test('늦은 응답·추가 필드·정답 키 덮어쓰기는 거부한다',async()=>{
 await env.withSecurityRulesDisabled(async context=>update(ref(context.database(),'sessions/123456'),{state:'question',qStart:Date.now()-200000}));
 await assertFails(set(ref(db('outsider'),'sessions/123456/answers/0/outsider'),{a:0,t:serverTimestamp()}));
 await assertFails(set(ref(db('outsider'),'sessionKeys/123456'),{owner:'outsider',questions:[{answer:0}]}));
 await assertFails(set(ref(db('outsider'),'sessions/123456/players/new'),{name:'위조',score:0,last:0,admin:true}));
});
test('혼자 푸는 학습은 소유자만 열고 참가할 수 있다',async()=>{
 const owner=db('teacher'), outsider=db('outsider');
 await assertSucceeds(set(ref(owner,'sessions/456789'),{owner:'teacher',mode:'self',solo:true,state:'question',q:-1,total:1,createdAt:serverTimestamp(),questions:[{q:'혼자 풀기',time:120,options:['O','X']}]}));
 await assertSucceeds(set(ref(owner,'sessionKeys/456789'),{owner:'teacher',questions:[{answer:0,text:'O'}]}));
 await assertFails(get(ref(outsider,'sessions/456789')));
 await assertFails(set(ref(outsider,'sessions/456789/players/outsider'),{name:'다른 사람',score:0,last:0}));
 await assertFails(remove(ref(owner,'sessions/456789/solo')));
 await assertSucceeds(set(ref(owner,'sessions/456789/players/teacher'),{name:'나',score:0,last:0}));
 await assertSucceeds(set(ref(owner,'sessions/456789/starts/teacher/0'),{q:0,t:serverTimestamp()}));
 await assertSucceeds(set(ref(owner,'sessions/456789/answers/0/teacher'),{a:0,t:serverTimestamp()}));
 await assertSucceeds(get(ref(owner,'sessionKeys/456789/questions/0')));
 await assertSucceeds(remove(ref(owner,'sessionKeys/456789')));
 await assertSucceeds(remove(ref(owner,'sessions/456789')));
});
