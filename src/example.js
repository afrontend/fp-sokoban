#!/usr/bin/env node
const { inspect, styleText } = require("node:util");
const readline = require("node:readline");
const game = require("../lib/index.js");

// 화면 지우기 + 커서를 맨 위로 (clear 패키지와 같은 시퀀스)
const clear = () => process.stdout.write("\x1b[2J\x1b[0f");

const HELP_TEXT = [
  "",
  "  조작:",
  "  ← ↑ → ↓          이동 및 상자 밀기",
  "  Space            일시정지 / 재개",
  "  r                레벨 다시 시작",
  "  n                완료 후 다음 레벨",
  "  [ / ]            이전 / 다음 레벨",
  "  ?                휴리스틱 AI 힌트",
  "  s / l            빠른 저장 / 불러오기",
  "  h                도움말 열기 / 닫기",
  "  ^D               스냅숏 JSON 출력 후 종료",
  "  q / ^C           종료",
].join("\r\n");

const colorCell = (color, symbol) =>
  Object.hasOwn(inspect.colors, color) ? styleText(color, symbol) : symbol;

const SYMBOLS = {
  grey: "  ",
  [game.COLORS.wall]: colorCell(game.COLORS.wall, "██"),
  [game.COLORS.target]: colorCell(game.COLORS.target, "··"),
  [game.COLORS.crate]: colorCell(game.COLORS.crate, "▣ "),
  [game.COLORS.crateOnTarget]: colorCell(game.COLORS.crateOnTarget, "▣ "),
  [game.COLORS.player]: colorCell(game.COLORS.player, "● "),
};

const format = (panel) =>
  panel
    .map((row) => row.map((cell) => SYMBOLS[cell.color] ?? "? ").join(""))
    .join("\r\n");

const gameContext = {
  state: game.initLevel(1),
  savedState: null,
  showHelp: false,
  message: "",
  messageUntil: 0,
};

const setMessage = (message) => {
  gameContext.message = message;
  gameContext.messageUntil = Date.now() + 2000;
};

const render = () => {
  clear();
  console.log(styleText(["bold", "yellow"], "fp-sokoban\r\n"));
  console.log(
    `레벨 ${gameContext.state.levelNumber}/${game.getLevelCount()} ` +
      `— ${gameContext.state.levelName} (${gameContext.state.difficulty})\r\n`,
  );
  console.log(format(game.join(gameContext.state)));
  console.log(
    `\r\n크기: ${gameContext.state.rows}×${gameContext.state.columns}  ` +
      `이동: ${gameContext.state.moves}  밀기: ${gameContext.state.pushes}`,
  );
  if (gameContext.state.paused) console.log(styleText("yellow", "일시정지"));
  if (gameContext.state.isCleared) {
    console.log(
      styleText(
        ["bold", "green"],
        "레벨을 완료했습니다! r 키로 다시 시작하세요.",
      ),
    );
  }
  if (gameContext.showHelp) console.log(HELP_TEXT);
  else {
    console.log(
      "\r\n[h] 도움말  [?] 힌트  [r] 다시 시작  [n] 다음 레벨  [q] 종료",
    );
  }
  if (Date.now() < gameContext.messageUntil) {
    console.log(styleText("cyan", gameContext.message));
  }
};

const restart = () => {
  gameContext.state = game.initLevel(gameContext.state.levelNumber ?? 1);
  setMessage("현재 레벨을 다시 시작했습니다.");
};

const changeLevel = (offset) => {
  const current = gameContext.state.levelNumber ?? 1;
  const next = Math.min(game.getLevelCount(), Math.max(1, current + offset));
  gameContext.state = game.initLevel(next);
  setMessage(`레벨 ${next}을 시작합니다.`);
};

const showHint = () => {
  setMessage("힌트를 계산하고 있습니다...");
  render();
  const hint = game.getHint(gameContext.state);
  const labels = { up: "위", down: "아래", left: "왼쪽", right: "오른쪽" };
  if (!hint.solved) setMessage("이 상태에서는 풀이를 찾지 못했습니다.");
  else if (!hint.direction) setMessage("이미 완료된 상태입니다.");
  else {
    setMessage(
      `힌트: ${labels[hint.direction]}으로 이동하세요. ` +
        `(남은 최소 밀기 ${hint.pushes}회)`,
    );
  }
};

const save = () => {
  gameContext.savedState = game.serializeState(gameContext.state);
  setMessage("빠르게 저장했습니다.");
};

const load = () => {
  if (!gameContext.savedState) {
    setMessage("저장된 상태가 없습니다.");
    return;
  }
  try {
    gameContext.state = game.restoreState(gameContext.savedState);
    setMessage("저장된 상태를 불러왔습니다.");
  } catch (error) {
    setMessage("저장된 상태를 불러올 수 없습니다.");
    if (process.env.DEBUG) console.error(error);
  }
};

readline.emitKeypressEvents(process.stdin);
process.stdin.on("keypress", (character, key) => {
  if (key?.ctrl && key.name === "c") process.exit();
  if (key?.ctrl && key.name === "d") {
    console.log(
      JSON.stringify(game.serializeState(gameContext.state), null, 2),
    );
    process.exit();
  }

  const keyName = key?.name ?? character;
  if (keyName === "q") process.exit();
  if (keyName === "h") gameContext.showHelp = !gameContext.showHelp;
  else if (keyName === "r") restart();
  else if (keyName === "n") {
    const next = game.nextLevel(gameContext.state);
    if (next === gameContext.state) {
      setMessage(
        gameContext.state.isCleared
          ? "마지막 레벨입니다."
          : "현재 레벨을 먼저 완료하세요.",
      );
    } else gameContext.state = next;
  } else if (keyName === "[") changeLevel(-1);
  else if (keyName === "]") changeLevel(1);
  else if (keyName === "?") showHint();
  else if (keyName === "s") save();
  else if (keyName === "l") load();
  else if (!gameContext.showHelp) {
    gameContext.state = game.key(keyName, gameContext.state);
  }
  render();
});

if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();
render();
