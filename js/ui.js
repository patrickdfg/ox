// 모든 화면에서 다크 모드와 PWA 등록을 관리합니다.
(() => {
  const key = "quiz-play-theme";
  const saved = localStorage.getItem(key);
  const dark = saved === "dark" || (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const apply = enabled => {
    document.documentElement.dataset.theme = enabled ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", enabled ? "#171025" : "#251452");
    document.querySelectorAll(".theme-toggle").forEach(button => {
      button.textContent = enabled ? "☀" : "☾";
      button.setAttribute("aria-label", enabled ? "라이트 모드로 변경" : "다크 모드로 변경");
      button.setAttribute("aria-pressed", String(enabled));
      button.title = enabled ? "라이트 모드" : "다크 모드";
    });
  };
  apply(dark);
  const header = document.querySelector(".topbar, .editor-top, .game-top");
  if (header) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
    const controls = header.querySelector(".account-actions, .editor-actions, .top-right");
    if (controls) controls.prepend(button);
    else header.querySelector(".live-badge")?.before(button);
    button.addEventListener("click", () => {
      const enabled = document.documentElement.dataset.theme !== "dark";
      localStorage.setItem(key, enabled ? "dark" : "light");
      apply(enabled);
    });
    apply(dark);
  }
  if ("serviceWorker" in navigator) {
    addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { scope: "./" })
        .catch(error => console.warn("PWA 등록 실패", error));
    });
  }
})();
