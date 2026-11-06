// 기존 게임과 새 모드가 같은 채점과 공동 순위를 사용합니다.
export function calcPoints(correct, elapsedMs, limitSec) {
  if (!correct) return 0;
  const ratio = Math.max(0, 1 - elapsedMs / (limitSec * 1000));
  return 500 + Math.round(500 * ratio);
}

export function rankPlayers(players) {
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  return sorted.map(player => ({ ...player, rank: sorted.filter(other => (other.score || 0) > (player.score || 0)).length + 1 }));
}

// 기기·브라우저가 바뀌어 같은 닉네임이 여러 번 등록되면 한 명으로 합치고 점수를 더합니다.
export function mergeByName(players) {
  const merged = new Map();
  for (const player of players) {
    const key = String(player.name ?? "").trim(), same = merged.get(key);
    if (same) { same.ids.push(player.id); same.score += player.score || 0; same.last += player.last || 0; }
    else merged.set(key, { ...player, ids: [player.id], score: player.score || 0, last: player.last || 0 });
  }
  return [...merged.values()];
}
