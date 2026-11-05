import {auth,authReady} from './auth.js';
export async function grade(pin,action='report',q) {
 await authReady;if(!auth.currentUser)throw Error('로그인이 필요해요.');
 const token=await auth.currentUser.getIdToken();
 const r=await fetch('https://maoylwwnluyyfmwqfkfl.supabase.co/functions/v1/quiz-grade',{method:'POST',headers:{'Content-Type':'application/json',apikey:'sb_publishable_RR5lrEd5ZidVI1fY1v9haw_Hd7pOH1V',Authorization:`Bearer ${token}`},body:JSON.stringify({pin,action,...(q===undefined?{}:{q})}),signal:AbortSignal.timeout(60000)});
 const result=await r.json();if(!r.ok)throw Error(result.error||'채점 서버에 연결하지 못했어요.');return result;
}
