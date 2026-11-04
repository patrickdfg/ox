// Firebase 실시간 DB 연결과 공용 함수
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getDatabase, ref, set, update, get, remove, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";
import { firebaseConfig } from "./config.js";

export const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const at = (path) => ref(db, path);
export { set, update, get, remove, onValue, serverTimestamp };
let serverOffset = 0;
onValue(ref(db, ".info/serverTimeOffset"), snapshot => { serverOffset = snapshot.val() || 0; });
export const now = () => Date.now() + serverOffset;

export { calcPoints } from "./game-math.mjs";

// HTML 특수문자 바꾸기 (닉네임 표시용)
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

