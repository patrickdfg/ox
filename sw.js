// 퀴즈 플레이의 정적 화면을 오프라인에서도 열 수 있도록 저장합니다.
const CACHE = "quiz-play-pwa-20261104-audio";
const FILES = ["./", "./index.html", "./editor.html", "./host.html", "./play.html",
 "./style.css", "./style.css?v=20261104-contrast", "./classroom.html", "./js/classroom.js", "./js/race.js", "./reports.html", "./js/session.js", "./js/reports.mjs", "./js/report-page.js", "./manifest.json", "./assets/favicon.svg", "./assets/icon-192.png",
 "./assets/icon-512.png", "./assets/cosmic.jpg", "./js/ui.js", "./js/home.js",
 "./js/editor.js", "./js/host.js", "./js/play.js", "./js/store.js", "./js/auth.js",
 "./js/game-math.mjs", "./js/game-effects.js", "./js/db.js", "./js/config.js", "./js/questions.js", "./js/manuscript.js"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names
    .filter(name => name.startsWith("quiz-play-pwa-") && name !== CACHE)
    .map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }).catch(async () => {
    const saved = await caches.match(request, { ignoreSearch: true });
    if (saved) return saved;
    if (request.mode === "navigate") return caches.match("./index.html");
    return Response.error();
  }));
});
