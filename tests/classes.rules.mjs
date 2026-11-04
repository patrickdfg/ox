import {readFile}from'node:fs/promises';
import{before,after,test}from'node:test';
import{initializeTestEnvironment,assertSucceeds,assertFails}from'@firebase/rules-unit-testing';
import{ref,set,get,remove,serverTimestamp}from'firebase/database';
let env;
const db=(uid,google=false)=>env.authenticatedContext(uid,google?{firebase:{sign_in_provider:'google.com'},email_verified:true}:{}).database();
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-quiz-play',database:{host:'127.0.0.1',port:9000,rules:await readFile(new URL('../database.rules.json',import.meta.url),'utf8')}});await env.withSecurityRulesDisabled(async c=>set(ref(c.database(),'classes'),null));});
after(async()=>env?.cleanup());
test('Google 교사만 클래스를 만들 수 있고 다른 교사에게 소유권을 이전할 수 없다',async()=>{
 await assertFails(set(ref(db('guest'),'classes/AAAAAAAA'),{owner:'guest',meta:{title:'위조',createdAt:serverTimestamp()}}));
 await assertSucceeds(set(ref(db('teacher',true),'classes/ABCDEF12'),{owner:'teacher',meta:{title:'우리 반',createdAt:serverTimestamp()}}));
 await assertFails(set(ref(db('other',true),'classes/ABCDEF12/owner'),'other'));
 await assertFails(set(ref(db('teacher',true),'classes/ABCDEF12/owner'),'other'));
});
test('학생은 자기 별명으로만 참가하고 명단·다른 교사의 클래스는 읽지 못한다',async()=>{
 await assertSucceeds(get(ref(db('student'),'classes/ABCDEF12/meta')));
 await assertSucceeds(set(ref(db('student'),'classes/ABCDEF12/members/student'),{name:'학습자',joinedAt:serverTimestamp()}));
 await assertFails(set(ref(db('student'),'classes/ABCDEF12/members/other'),{name:'위조',joinedAt:serverTimestamp()}));
 await assertFails(get(ref(db('student'),'classes/ABCDEF12/members')));
 await assertFails(get(ref(db('other',true),'classes/ABCDEF12')));
 await assertSucceeds(get(ref(db('teacher',true),'classes/ABCDEF12/members')));
});
test('배정·세션·정답은 해당 클래스 회원만 접근하고 다른 클래스에 배정할 수 없다',async()=>{
 const game={owner:'teacher',classCode:'ABCDEF12',mode:'self',state:'question',q:-1,total:1,createdAt:serverTimestamp(),questions:[{q:'문제',time:60,options:['O','X']}]};
 await assertSucceeds(set(ref(db('teacher',true),'sessions/345678'),game));
 await assertSucceeds(set(ref(db('teacher',true),'sessionKeys/345678'),{owner:'teacher',questions:[{answer:0,text:'O'}]}));
 await assertSucceeds(set(ref(db('teacher',true),'classes/ABCDEF12/assignments/quiz'),{title:'배정',pin:'345678',createdAt:serverTimestamp()}));
 await assertFails(get(ref(db('outsider'),'classes/ABCDEF12/assignments')));
 await assertSucceeds(get(ref(db('student'),'classes/ABCDEF12/assignments')));
 await assertFails(get(ref(db('outsider'),'sessions/345678')));
 await assertFails(set(ref(db('outsider'),'sessions/345678/players/outsider'),{name:'외부인',score:0,last:0}));
 await assertSucceeds(set(ref(db('student'),'sessions/345678/players/student'),{name:'학습자',score:0,last:0}));
 await assertFails(set(ref(db('other',true),'sessions/456789'),{...game,owner:'other'}));
 await assertFails(get(ref(db('student'),'sessionKeys/345678')));
});
test('회원 삭제 즉시 접근이 차단되고 교사가 클래스·배정·기록을 삭제할 수 있다',async()=>{
 await assertSucceeds(remove(ref(db('teacher',true),'classes/ABCDEF12/members/student')));
 await assertFails(get(ref(db('student'),'sessions/345678')));
 await assertFails(set(ref(db('student'),'sessions/345678/starts/student/0'),{q:0,t:serverTimestamp()}));
 await assertSucceeds(remove(ref(db('teacher',true),'sessionKeys/345678')));
 await assertSucceeds(remove(ref(db('teacher',true),'sessions/345678')));
 await assertSucceeds(remove(ref(db('teacher',true),'classes/ABCDEF12')));
});
