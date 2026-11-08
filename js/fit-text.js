// 긴 보기·정답 글자가 상자를 넘치지 않도록 글자 크기를 줄입니다.
// 상자가 최소 높이보다 커졌으면 글자가 넘친 것으로 봅니다.
const fits = el => {
  const style = getComputedStyle(el), min = parseFloat(style.minHeight) || 0;
  const extra = style.boxSizing === "border-box" ? 0 : ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce((sum, key) => sum + parseFloat(style[key]), 0);
  return el.offsetHeight <= min + extra + 1;
};

// 보기 상자들은 같은 크기로 맞추고, 가장 긴 보기가 상자 높이를 넘지 않을 때까지 함께 줄입니다.
export function fitTiles(container, minScale = 0.45) {
  const tiles = [...container.querySelectorAll(".answer-tile")];
  if (!tiles.length) return;
  tiles.forEach(tile => tile.style.fontSize = "");
  const base = parseFloat(getComputedStyle(tiles[0]).fontSize);
  for (let scale = 1; scale >= minScale && !tiles.every(fits); scale -= 0.05) {
    tiles.forEach(tile => tile.style.fontSize = `${base * scale}px`);
  }
}

// 정답 글자는 원래 크기 기준 두 줄 안에 들어오도록 줄입니다.
export function fitLines(el, lines = 2, minScale = 0.3) {
  el.style.fontSize = "";
  const base = parseFloat(getComputedStyle(el).fontSize);
  for (let scale = 1; scale >= minScale && el.offsetHeight > base * 1.35 * lines; scale -= 0.05) {
    el.style.fontSize = `${base * scale}px`;
  }
}
