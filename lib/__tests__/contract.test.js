const { runGameContract } = require("fp-panel/testing");
const game = require("../index.js");

// 크기는 레벨 지도에서 정해지고 tick 없이 키 입력으로만 진행하는 턴제 게임이다.
runGameContract(game, {
  name: "fp-sokoban",
  sizedInit: false,
  turnBased: true,
});
