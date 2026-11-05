const ALLOWED_ORIGIN = "https://patrickdfg.github.io";
const MAX_SOURCE = 15000;

// 객관식 정답의 위치를 고르게 분산하되 정답 내용과 해설은 유지합니다.
export function distributeChoiceAnswers(questions) {
  const targets = questions.filter(question => question.type === "choice")
    .map((_, index) => index % 4);
  const shuffle = values => {
    for (let i = values.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
  };
  shuffle(targets);
  let choiceIndex = 0;
  for (const question of questions) {
    if (question.type !== "choice") continue;
    const choices = question.options.map((text, index) => ({
      text, correct: index === question.answer
    }));
    shuffle(choices);
    const target = targets[choiceIndex++];
    const current = choices.findIndex(choice => choice.correct);
    [choices[current], choices[target]] = [choices[target], choices[current]];
    question.options = choices.map(choice => choice.text);
    question.answer = target;
  }
  return questions;
}

export function createHandler({ verify, generate }) {
  return async request => {
    const origin = request.headers.get("origin");
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin" };
    if (origin === ALLOWED_ORIGIN) Object.assign(headers, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" });
    const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers });
    if (origin !== ALLOWED_ORIGIN) return reply({ error: "허용되지 않은 요청입니다." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return reply({ error: "POST 요청만 지원합니다." }, 405);
    const authorization = request.headers.get("authorization") || "";
    if (!/^Bearer \S+$/.test(authorization)) return reply({ error: "Google 로그인이 필요합니다." }, 401);
    let uid;
    try { uid = await verify(authorization.slice(7)); }
    catch { return reply({ error: "로그인 정보를 확인하지 못했어요. 다시 로그인해 주세요." }, 401); }
    if (!uid) return reply({ error: "Google 로그인이 필요합니다." }, 401);
    let text = "";
    try {
      if (!request.body) return reply({ error: "원고를 입력해 주세요." }, 400);
      const reader = request.body.getReader(), decoder = new TextDecoder();
      let bytes = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 100000) { await reader.cancel(); return reply({ error: "원고가 너무 깁니다." }, 413); }
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
      let body;
      try { body = JSON.parse(text); }
      catch { return reply({ error: "요청 형식을 확인해 주세요." }, 400); }
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(k => !["source", "count", "type"].includes(k))) return reply({ error: "요청 형식을 확인해 주세요." }, 400);
      const source = typeof body.source === "string" ? body.source.trim() : "";
      if (!source || source.length > MAX_SOURCE) return reply({ error: "원고나 퀴즈 주제를 입력해 주세요. (최대 15,000자)" }, 400);
      if (!Number.isInteger(body.count) || body.count < 1 || body.count > 20 || !["ox", "choice", "mixed"].includes(body.type)) return reply({ error: "문제 수와 유형을 확인해 주세요." }, 400);
      const items = await generate(source, body.count, body.type);
      if (!Array.isArray(items) || items.length !== body.count) throw new Error("invalid");
      const questions = items.map(item => {
        if (!item || !["ox", "choice"].includes(item.type) || (body.type !== "mixed" && item.type !== body.type) || typeof item.q !== "string" || !item.q.trim() || item.q.length > 250 || typeof item.exp !== "string" || !item.exp.trim() || item.exp.length > 300 || !Array.isArray(item.options) || item.options.some(option => typeof option !== "string" || !option.trim() || option.length > 100)) throw new Error("invalid");
        const options = item.options.map(option => option.trim());
        if (item.type === "ox" ? options.length !== 2 || options[0] !== "O" || options[1] !== "X" : options.length !== 4 || new Set(options).size !== 4) throw new Error("invalid");
        if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= options.length) throw new Error("invalid");
        return { type: item.type, q: item.q.trim(), options, answer: item.answer, exp: item.exp.trim(), time: 20 };
      });
      return reply({ questions: distributeChoiceAnswers(questions) });
    } catch (error) {
      if (error?.providerStatus === 429) return reply({ error: "Gemini API 사용 한도에 도달했어요. Gemini 사용량과 결제 설정을 확인해 주세요." }, 429);
      if ([500, 502, 503, 504].includes(error?.providerStatus)) return reply({ error: "Gemini 서버가 일시적으로 응답하지 않아요. 자동 재시도 후에도 실패했으니 잠시 뒤 다시 시도해 주세요." }, 503);
      return reply({ error: "문제를 만들지 못했어요. 잠시 후 다시 시도해 주세요." }, 502);
    }
  };
}
