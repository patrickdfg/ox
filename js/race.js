import { rankPlayers } from "./game-math.mjs";
const esc = value => String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function renderRace(container, game) {
  container.hidden=game.mode!=="battle"||game.state==="lobby";
  if(container.hidden) return;
  const players=rankPlayers(Object.entries(game.players||{}).map(([id,p])=>({id,...p})));
  const maximum=game.total*1000;
  const signature=JSON.stringify(players.map(p=>[p.id,p.score,p.name]));
  if(container.dataset.race===signature) return;container.dataset.race=signature;
  container.querySelector('.race-lanes').innerHTML=players.map((p,index)=>`<div class="race-lane"><div class="race-label"><b>${p.rank}위 · ${esc(p.name)}</b><span>${p.score||0}점</span></div><div class="star-route" style="--ship:${Math.min(100,100*(p.score||0)/maximum)}%;--hue:${index*67%360}"><span class="race-ship" aria-hidden="true">◈➤</span><span class="race-goal" aria-hidden="true">✦</span><progress class="sr-only" aria-label="${esc(p.name)}의 우주 경주 점수" value="${p.score||0}" max="${maximum}">${p.score||0} / ${maximum}</progress></div></div>`).join('');
}
