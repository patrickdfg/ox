// 저장된 퀴즈를 문제·정답 공개·다음 문제 순서로 넘기는 슬라이드 상태 관리
export function advanceSlide(state, total) {
  if (state.finished || total < 1) return state;
  if (!state.revealed) return { index: state.index, revealed: true, finished: false };
  if (state.index === total - 1) return { index: total, revealed: false, finished: true };
  return { index: state.index + 1, revealed: false, finished: false };
}
export function retreatSlide(state, total) {
  if (state.finished) return { index: Math.max(0, total - 1), revealed: true, finished: false };
  if (state.revealed) return { index: state.index, revealed: false, finished: false };
  return state.index ? { index: state.index - 1, revealed: true, finished: false } : state;
}
