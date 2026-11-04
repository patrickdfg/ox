import { calcPoints } from "./game-math.mjs";

export function buildReport(quiz, game) {
  const rows = [];
  for (const [uid, player] of Object.entries(game.players || {})) {
    quiz.questions.forEach((question, q) => {
      const answer = game.answers?.[q]?.[uid];
      const start = game.mode === "self" ? game.starts?.[uid]?.[q]?.t : game.questionStarts?.[q];
      const elapsed = answer && start ? Math.max(0, answer.t - start) : null;
      const correct = Boolean(answer && answer.a === question.answer && elapsed !== null && elapsed <= question.time * 1000);
      rows.push({ uid, name: player.name, q: q + 1, question: question.q, selected: answer && answer.a >= 0 ? question.options[answer.a] : "미응답", answer: question.options[question.answer], correct, elapsedMs: elapsed, points: correct ? calcPoints(true, elapsed, question.time) : 0, exp: question.exp || "" });
    });
  }
  return { classCode: game.classCode || null, assignmentId: game.assignmentId || null, title: quiz.title, mode: game.mode || "live", createdAt: game.createdAt, rows };
}

export function summarize(rows, field) {
  return [...new Set(rows.map(row => row[field]))].map(key => {
    const group = rows.filter(row => row[field] === key);
    const times = group.filter(row => row.elapsedMs !== null);
    return { key, name: field === "uid" ? group[0].name : `${key}. ${group[0].question}`, correct: group.filter(row => row.correct).length, total: group.length, accuracy: Math.round(100 * group.filter(row => row.correct).length / group.length), meanMs: times.length ? Math.round(times.reduce((sum, row) => sum + row.elapsedMs, 0) / times.length) : null, score: group.reduce((sum,row) => sum + row.points,0) };
  });
}

// 수식으로 해석될 수 있는 닉네임·문제도 CSV에서 텍스트로 취급합니다.
export function reportCsv(report) {
  const cell = value => '"' + String(/^[=+@\-\t\r]/.test(String(value)) ? "'" + value : value).replaceAll('"','""') + '"';
  const lines = [["학생", "문제 번호", "문제", "제출 답", "정답", "정답 여부", "응답 시간(초)", "점수"], ...report.rows.map(row => [row.name,row.q,row.question,row.selected,row.answer,row.correct ? "O" : "X",row.elapsedMs === null ? "" : (row.elapsedMs/1000).toFixed(3),row.points])];
  return "\uFEFF" + lines.map(line=>line.map(cell).join(",")).join("\r\n");
}
