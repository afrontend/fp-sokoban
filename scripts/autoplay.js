#!/usr/bin/env node
// AI autoplay for fp-sokoban demo recording.
// Strategy: solve each level with the built-in A* solver, then replay the
// solution one move per frame and advance to the next level after clearing.

const { styleText } = require("node:util");
const { format } = require("../src/format.js");
const game = require("../lib/index.js");

// 화면 지우기 + 커서를 맨 위로 (clear 패키지와 같은 시퀀스)
const clear = () => process.stdout.write("\x1b[2J\x1b[0f");

const FRAME_INTERVAL_MS = 200;
// 새 레벨은 풀이가 길어 앞 4개만 녹화한다 (약 170 수, GIF 20초 안팎).
const LAST_LEVEL = Math.min(4, game.getLevelCount());
// Frames to hold the cleared board before moving on.
const CLEAR_HOLD_FRAMES = 6;

// 녹화 중에 멈추지 않도록 풀이는 미리 계산해 둔다.
const solutions = Array.from({ length: LAST_LEVEL }, (_, index) => {
  const result = game.solve(game.initLevel(index + 1));
  if (!result.solved) throw new Error(`레벨 ${index + 1}을 풀지 못했습니다.`);
  return result.actions;
});

let state = game.initLevel(1);
let moveIndex = 0;
let holdFrames = 0;

const render = () => {
  clear();
  console.log(styleText(["bold", "yellow"], "fp-sokoban\r\n"));
  console.log(
    `레벨 ${state.levelNumber}/${game.getLevelCount()} ` +
      `— ${state.levelName} (${state.difficulty})\r\n`,
  );
  console.log(format(game.join(state)));
  console.log(`\r\n이동: ${state.moves}  밀기: ${state.pushes}`);
  if (state.isCleared) console.log(styleText(["bold", "green"], "완료!"));
};

const step = () => {
  if (!state.isCleared) {
    state = game.key(solutions[state.levelNumber - 1][moveIndex], state);
    moveIndex += 1;
    return;
  }
  holdFrames += 1;
  if (holdFrames < CLEAR_HOLD_FRAMES) return;
  if (state.levelNumber >= LAST_LEVEL) {
    clearInterval(timer);
    process.exit(0);
  }
  state = game.nextLevel(state);
  moveIndex = 0;
  holdFrames = 0;
};

render();
const timer = setInterval(() => {
  step();
  render();
}, FRAME_INTERVAL_MS);
