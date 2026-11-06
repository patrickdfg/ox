import test from "node:test";
import assert from "node:assert/strict";
import { calcPoints, rankPlayers, mergeByName } from "../js/game-math.mjs";
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
test("같은 닉네임은 한 명으로 합치고 점수를 더한다", () => {
  const merged = mergeByName([{id:"a",name:"이하루",score:9316,last:800},{id:"b",name:"김디빙",score:12519,last:0},{id:"c",name:"이하루 ",score:3534,last:0},{id:"d",name:"김디빙",score:0,last:0}]);
  assert.deepEqual(merged.map(p => [p.name, p.score, p.last, p.ids]), [["이하루",12850,800,["a","c"]],["김디빙",12519,0,["b","d"]]]);
});
