// Firebase 실시간 DB 연결과 공용 함수
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getDatabase, ref, set, update, get, remove, onValue, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";
import { firebaseConfig } from "./config.js";

export const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export const at = (path) => ref(db, path);
export { set, update, get, remove, onValue, serverTimestamp };

// 정답 시간에 따라 점수 계산 (맞히면 500점 + 빠를수록 최대 500점 추가)
export function calcPoints(correct, elapsedMs, limitSec) {
  if (!correct) return 0;
  const ratio = Math.max(0, 1 - elapsedMs / (limitSec * 1000));
  return 500 + Math.round(500 * ratio);
}

// HTML 특수문자 바꾸기 (닉네임 표시용)
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

