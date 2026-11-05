import {decodeProtectedHeader,importX509,jwtVerify} from 'npm:jose@5.9.6';
import {createHandler} from './core.mjs';
const project='gen-lang-client-0591184179',url='https://gen-lang-client-0591184179-default-rtdb.asia-southeast1.firebasedatabase.app';
let certs:Record<string,string>={},until=0;
async function verify(token:string){
 const h=decodeProtectedHeader(token);if(h.alg!=='RS256'||!h.kid)throw Error('identity');
 if(Date.now()>until||!certs[h.kid]){const r=await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('certificates');certs=await r.json();until=Date.now()+Number(r.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||300)*1000;}
 if(!certs[h.kid])throw Error('identity');
 const {payload}=await jwtVerify(token,await importX509(certs[h.kid],'RS256'),{algorithms:['RS256'],audience:project,issuer:`https://securetoken.google.com/${project}`,requiredClaims:['exp','iat','auth_time','sub']});
 const now=Math.floor(Date.now()/1000);if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>128||typeof payload.iat!=='number'||payload.iat>now||typeof payload.auth_time!=='number'||payload.auth_time>now)throw Error('identity');
 return payload.sub;
}
async function request(path:string,token:string,method='GET',value?:unknown){
 // Never use an Admin credential: Firebase rules independently check the caller.
 const r=await fetch(`${url}/${path}.json?auth=${encodeURIComponent(token)}`,{method,headers:{'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(value)}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('database');return r.json();
}
Deno.serve(createHandler({verify,read:(p:string,t:string)=>request(p,t),write:(p:string,v:unknown,t:string,m:string)=>request(p,t,m,v)}));
