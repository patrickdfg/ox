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
