import { at, get, set, serverTimestamp } from "./db.js";
import { auth, authReady } from "./auth.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

export async function participant() {
  await authReady;
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser;
}
export const sessionPath = pin => `sessions/${pin}`;
export async function findSession(pin) {
  const secure = await get(at(sessionPath(pin)));
  if (secure.exists()) return { path: sessionPath(pin), game:secure.val(), secure:true };
  const legacy = await get(at(`games/${pin}`));
  return legacy.exists() ? {path:`games/${pin}`,game:legacy.val(),secure:false} : null;
}
export async function saveKeys(pin, quiz, owner) {
  await set(at(`sessionKeys/${pin}`), {owner, questions:quiz.questions.map(item=>({answer:item.answer,exp:item.exp || "",text:item.options[item.answer]}))});
}
export async function startPersonalQuestion(pin, uid, q) {
  const path = `sessions/${pin}/starts/${uid}/${q}`;
  const saved = await get(at(path));
  if (!saved.exists()) await set(at(path),{t:serverTimestamp(),q});
  return (await get(at(path))).val().t;
}
