import { decodeProtectedHeader, importX509, jwtVerify } from "npm:jose@5.9.6";
import { buildPrompt, createHandler } from "./core.mjs";
import { fetchWithRetry } from "./provider.mjs";

const project = "gen-lang-client-0591184179";
const certUrl = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let certificates: Record<string, string> = {}, validUntil = 0;
async function verify(token: string) {
  const header = decodeProtectedHeader(token);
  if (header.alg !== "RS256" || !header.kid) throw new Error("invalid token");
  if (Date.now() >= validUntil || !certificates[header.kid]) {
    const response = await fetch(certUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("certificate unavailable");
    certificates = await response.json();
    const maxAge = Number((response.headers.get("cache-control") || "").match(/max-age=(\d+)/)?.[1] || 300);
    validUntil = Date.now() + maxAge * 1000;
  }
  if (!certificates[header.kid]) throw new Error("unknown certificate");
  const key = await importX509(certificates[header.kid], "RS256");
  const { payload } = await jwtVerify(token, key, { algorithms: ["RS256"], audience: project, issuer: `https://securetoken.google.com/${project}`, requiredClaims: ["exp", "iat", "auth_time", "sub"] });
  const now = Math.floor(Date.now() / 1000);
  const firebase = payload.firebase as { sign_in_provider?: string } | undefined;
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128 || typeof payload.iat !== "number" || payload.iat > now || typeof payload.auth_time !== "number" || payload.auth_time > now || firebase?.sign_in_provider !== "google.com" || payload.email_verified !== true) throw new Error("invalid identity");
  return payload.sub;
}
// 1차 모델이 막히면 core.mjs가 같은 원고로 대체 모델을 한 번 더 호출합니다.
const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
async function generate(source: string, count: number, type: string, model: string, difficulty: string) {
  const key = Deno.env.get("GEMINI_API_KEY")?.trim() || Deno.env.get("GEMINI_API_KEY_BACKUP")?.trim();
  if (!key) { console.error(JSON.stringify({event: "quiz_ai_provider", reason: "missing_key"})); throw new Error("AI unavailable"); }
  const schema = { type: "object", properties: { questions: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["ox", "choice"] }, q: { type: "string" }, options: { type: "array", items: { type: "string" } }, answer: { type: "integer" }, exp: { type: "string" } }, required: ["type", "q", "options", "answer", "exp"] } } }, required: ["questions"] };
  const prompt = buildPrompt(source, count, type, difficulty);
  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema, maxOutputTokens: 16384 } }), signal: AbortSignal.timeout(60000) });
  if (!response.ok) { const failure = await response.json().catch(() => ({})); console.error(JSON.stringify({event: "quiz_ai_provider", model, status: response.status, code: failure.error?.status || "unknown", reasons: (failure.error?.details || []).map((detail: {reason?: string}) => detail.reason).filter(Boolean)})); throw Object.assign(new Error("AI unavailable"), { providerStatus: response.status }); }
  const result = await response.json();
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== "STOP") throw new Error("incomplete");
  const raw = (candidate.content?.parts || []).filter((part: {thought?: boolean}) => !part.thought).map((part: {text?: string}) => part.text || "").join("");
  return JSON.parse(raw).questions;
}
Deno.serve(createHandler({ verify, generate, models: MODELS }));
