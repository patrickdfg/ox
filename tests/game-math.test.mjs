import test from "node:test";
import assert from "node:assert/strict";
import { calcPoints, rankPlayers } from "../js/game-math.mjs";
test("기존 500점 + 최대 500점 공식을 유지한다", () => {
  assert.equal(calcPoints(true, 0, 20), 1000);
  assert.equal(calcPoints(true, 10000, 20), 750);
  assert.equal(calcPoints(true, 20000, 20), 500);
  assert.equal(calcPoints(false, 0, 20), 0);
});
test("동점자는 같은 순위이며 다음 순위는 건너뛴다", () => {
  const players = [{name:"A",score:500},{name:"B",score:1000},{name:"C",score:1000},{name:"D",score:0}];
  assert.deepEqual(rankPlayers(players).map(p => p.rank), [1,1,3,4]);
  assert.equal(players[0].name,"A");
});
