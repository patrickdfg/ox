// 슬라이드 복습에서 문제·정답·다음 문제 순서와 되돌리기를 검사합니다.
import test from "node:test";
import assert from "node:assert/strict";
import { advanceSlide, retreatSlide } from "../js/slide-state.mjs";

test("클릭할 때 문제 → 정답 → 다음 문제 순서로 이동한다", () => {
  let state = { index: 0, revealed: false, finished: false };
  state = advanceSlide(state, 2);
  assert.deepEqual(state, { index: 0, revealed: true, finished: false });
  state = advanceSlide(state, 2);
  assert.deepEqual(state, { index: 1, revealed: false, finished: false });
  state = advanceSlide(state, 2);
  assert.deepEqual(state, { index: 1, revealed: true, finished: false });
  state = advanceSlide(state, 2);
  assert.deepEqual(state, { index: 2, revealed: false, finished: true });
});
test("이전 단계 버튼은 정답을 숨기거나 전 문제 정답으로 되돌아간다", () => {
  assert.deepEqual(retreatSlide({ index: 1, revealed: false, finished: false }, 3), { index: 0, revealed: true, finished: false });
  assert.deepEqual(retreatSlide({ index: 1, revealed: true, finished: false }, 3), { index: 1, revealed: false, finished: false });
  assert.deepEqual(retreatSlide({ index: 3, revealed: false, finished: true }, 3), { index: 2, revealed: true, finished: false });
  assert.deepEqual(retreatSlide({ index: 0, revealed: false, finished: false }, 3), { index: 0, revealed: false, finished: false });
});
test("끝나면 더 이상 다음 단계로 진행하지 않는다", () => {
  const ended = { index: 1, revealed: false, finished: true };
  assert.deepEqual(advanceSlide(ended, 1), ended);
});
