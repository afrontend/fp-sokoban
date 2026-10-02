const p = require("fp-panel");
const {
  LEVELS,
  SIZE_TIERS,
  getLevel,
  getLevelCount,
  getExpectedSize,
} = require("./levels.js");
const solver = require("./solver.js");
const generator = require("./generator.js");

const GAME_ID = "fp-sokoban";
const SNAPSHOT_VERSION = 1;
const MAX_DIMENSION = 500;

const COLORS = {
  wall: "white",
  target: "cyan",
  crate: "magenta",
  crateOnTarget: "yellow",
  player: "green",
};

const DEFAULT_LEVEL = LEVELS[0].map;

const positionKey = ({ row, column }) => `${row}:${column}`;
const hasPosition = (positions, position) =>
  positions.some(
    (item) => item.row === position.row && item.column === position.column,
  );

const assertPosition = (position, rows, columns, label) => {
  if (
    !Number.isInteger(position?.row) ||
    !Number.isInteger(position?.column) ||
    position.row < 0 ||
    position.row >= rows ||
    position.column < 0 ||
    position.column >= columns
  ) {
    throw new RangeError(`${label} 위치가 게임판 범위를 벗어났습니다.`);
  }
};

const parseLevel = (level = DEFAULT_LEVEL) => {
  if (!Array.isArray(level) || level.length === 0) {
    throw new TypeError("레벨은 한 줄 이상의 문자열 배열이어야 합니다.");
  }
  if (level.some((row) => typeof row !== "string" || row.length === 0)) {
    throw new TypeError("레벨의 각 행은 빈 문자열이 아니어야 합니다.");
  }

  const rows = level.length;
  const columns = level[0].length;
  if (rows > MAX_DIMENSION || columns > MAX_DIMENSION) {
    throw new RangeError(
      `레벨 크기는 최대 ${MAX_DIMENSION}×${MAX_DIMENSION}입니다.`,
    );
  }
  if (level.some((row) => row.length !== columns)) {
    throw new RangeError("레벨의 모든 행 길이는 같아야 합니다.");
  }

  const walls = [];
  const crates = [];
  const targets = [];
  let player;

  level.forEach((line, row) => {
    [...line].forEach((symbol, column) => {
      const position = { row, column };
      if (symbol === "#") walls.push(position);
      else if (symbol === "$") crates.push(position);
      else if (symbol === ".") targets.push(position);
      else if (symbol === "*") {
        crates.push(position);
        targets.push(position);
      } else if (symbol === "@" || symbol === "+") {
        if (player)
          throw new RangeError("플레이어는 정확히 한 명이어야 합니다.");
        player = position;
        if (symbol === "+") targets.push(position);
      } else if (symbol !== " ") {
        throw new SyntaxError(`지원하지 않는 레벨 문자: ${symbol}`);
      }
    });
  });

  if (!player) throw new RangeError("레벨에 플레이어(@)가 필요합니다.");
  if (crates.length === 0) throw new RangeError("레벨에 상자($)가 필요합니다.");
  if (crates.length !== targets.length) {
    throw new RangeError("상자와 목표 지점의 수가 같아야 합니다.");
  }

  return { rows, columns, walls, crates, targets, player };
};

const createPanels = ({ rows, columns, walls, targets, crates, player }) => {
  const wallPanel = p.paint(p.createPanel(rows, columns), walls, COLORS.wall);
  const targetPanel = p.paint(
    p.createPanel(rows, columns),
    targets,
    COLORS.target,
  );
  const cratePanel = crates.reduce(
    (panel, crate) =>
      p.paint(
        panel,
        [crate],
        hasPosition(targets, crate) ? COLORS.crateOnTarget : COLORS.crate,
      ),
    p.createPanel(rows, columns),
  );
  const playerPanel = p.paint(
    p.createPanel(rows, columns),
    [player],
    COLORS.player,
  );
  return { wallPanel, targetPanel, cratePanel, playerPanel };
};

const isCleared = ({ crates, targets }) =>
  crates.every((crate) => hasPosition(targets, crate));

const withPanels = (state) => ({ ...state, ...createPanels(state) });

const normalizeInitArguments = (options, legacyColumns, legacyLevel) => {
  if (Array.isArray(options) || options === undefined) {
    return { level: options ?? DEFAULT_LEVEL };
  }
  if (typeof options === "number") {
    const level = legacyLevel ?? DEFAULT_LEVEL;
    return { rows: options, columns: legacyColumns, level };
  }
  return options ?? {};
};

const init = (options, legacyColumns, legacyLevel) => {
  const normalized = normalizeInitArguments(
    options,
    legacyColumns,
    legacyLevel,
  );
  const selectedLevel = normalized.levelNumber
    ? getLevel(normalized.levelNumber)
    : null;
  const parsed = parseLevel(
    normalized.level ?? selectedLevel?.map ?? DEFAULT_LEVEL,
  );
  const rows = normalized.rows ?? parsed.rows;
  const columns = normalized.columns ?? parsed.columns;

  if (rows !== parsed.rows || columns !== parsed.columns) {
    throw new RangeError(
      "rows와 columns는 문자열 레벨 크기와 일치해야 합니다.",
    );
  }

  return withPanels({
    ...parsed,
    levelNumber: selectedLevel?.id ?? null,
    levelName: selectedLevel?.name ?? "사용자 레벨",
    difficulty: selectedLevel?.difficulty ?? null,
    minimumPushes: selectedLevel?.minimumPushes ?? null,
    minimumMoves: selectedLevel?.minimumMoves ?? null,
    moves: 0,
    pushes: 0,
    isCleared: isCleared(parsed),
    paused: false,
    pause: false,
  });
};

const initLevel = (levelNumber = 1) => init({ levelNumber });

const nextLevel = (state) => {
  if (!state.isCleared || state.levelNumber === null) return state;
  if (state.levelNumber >= getLevelCount()) return state;
  return initLevel(state.levelNumber + 1);
};

const DIRECTIONS = {
  left: { row: 0, column: -1 },
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
};

const addPosition = (position, offset) => ({
  row: position.row + offset.row,
  column: position.column + offset.column,
});

const isInBounds = ({ row, column }, state) =>
  row >= 0 && row < state.rows && column >= 0 && column < state.columns;

const togglePause = (state) => {
  const paused = !(state.paused ?? state.pause);
  return { ...state, paused, pause: paused };
};

const move = (direction, state) => {
  const nextPlayer = addPosition(state.player, direction);
  if (!isInBounds(nextPlayer, state) || hasPosition(state.walls, nextPlayer)) {
    return state;
  }

  const crateIndex = state.crates.findIndex(
    (crate) => positionKey(crate) === positionKey(nextPlayer),
  );
  if (crateIndex === -1) {
    return withPanels({
      ...state,
      player: nextPlayer,
      moves: state.moves + 1,
    });
  }

  const nextCrate = addPosition(nextPlayer, direction);
  if (
    !isInBounds(nextCrate, state) ||
    hasPosition(state.walls, nextCrate) ||
    hasPosition(state.crates, nextCrate)
  ) {
    return state;
  }

  const crates = state.crates.map((crate, index) =>
    index === crateIndex ? nextCrate : crate,
  );
  const nextState = {
    ...state,
    player: nextPlayer,
    crates,
    moves: state.moves + 1,
    pushes: state.pushes + 1,
  };
  return withPanels({ ...nextState, isCleared: isCleared(nextState) });
};

const key = (keyName, state) => {
  if (keyName === "space") return togglePause(state);
  const direction = DIRECTIONS[keyName];
  if (!direction || state.isCleared || (state.paused ?? state.pause)) {
    return state;
  }
  return move(direction, state);
};

const tick = (state) => state;
const join = (state) =>
  p.add([
    state.wallPanel,
    state.targetPanel,
    state.cratePanel,
    state.playerPanel,
  ]);
const toArray = (state) =>
  structuredClone([
    state.wallPanel,
    state.targetPanel,
    state.cratePanel,
    state.playerPanel,
  ]);
const getDimensions = (state) => ({
  rows: state.rows,
  columns: state.columns,
});
const getTickInterval = () => null;

const serializeState = (state) => ({
  game: GAME_ID,
  version: SNAPSHOT_VERSION,
  state: structuredClone(state),
});

const restoreState = (snapshot) => {
  if (!snapshot || snapshot.game !== GAME_ID) {
    throw new TypeError("fp-sokoban 스냅숏이 아닙니다.");
  }
  if (snapshot.version !== SNAPSHOT_VERSION) {
    throw new RangeError(`지원하지 않는 스냅숏 버전: ${snapshot.version}`);
  }

  const restored = structuredClone(snapshot.state);
  const requiredArrays = ["walls", "targets", "crates"];
  if (
    !restored ||
    !Number.isInteger(restored.rows) ||
    !Number.isInteger(restored.columns) ||
    requiredArrays.some((name) => !Array.isArray(restored[name]))
  ) {
    throw new TypeError("스냅숏에 필수 상태가 없습니다.");
  }
  if (
    restored.rows < 1 ||
    restored.rows > MAX_DIMENSION ||
    restored.columns < 1 ||
    restored.columns > MAX_DIMENSION
  ) {
    throw new RangeError("스냅숏의 게임판 크기가 올바르지 않습니다.");
  }

  assertPosition(restored.player, restored.rows, restored.columns, "플레이어");
  restored.walls.forEach((item) =>
    assertPosition(item, restored.rows, restored.columns, "벽"),
  );
  restored.targets.forEach((item) =>
    assertPosition(item, restored.rows, restored.columns, "목표"),
  );
  restored.crates.forEach((item) =>
    assertPosition(item, restored.rows, restored.columns, "상자"),
  );

  const paused = (restored.paused ?? restored.pause) === true;
  return withPanels({
    ...restored,
    moves: Number.isInteger(restored.moves) ? restored.moves : 0,
    pushes: Number.isInteger(restored.pushes) ? restored.pushes : 0,
    isCleared: isCleared(restored),
    paused,
    pause: paused,
  });
};

module.exports = {
  COLORS,
  DEFAULT_LEVEL,
  LEVELS,
  SIZE_TIERS,
  parseLevel,
  init,
  initLevel,
  nextLevel,
  getLevel,
  getLevelCount,
  getExpectedSize,
  tick,
  key,
  join,
  isBlank: p.isBlankItem,
  toArray,
  getDimensions,
  getTickInterval,
  serializeState,
  restoreState,
  solve: solver.solve,
  getHint: solver.getHint,
  getDeadSquares: solver.getDeadSquares,
  isDeadlocked: solver.isDeadlocked,
  evaluateDifficulty: solver.evaluateDifficulty,
  generateCandidate: generator.generateCandidate,
  validateCandidate: generator.validateCandidate,
  scoreCandidate: generator.scoreCandidate,
  canonicalizeLevel: generator.canonicalizeLevel,
  generateLevels: generator.generateLevels,
  DEFAULT_GENERATOR_OPTIONS: generator.DEFAULT_GENERATOR_OPTIONS,
};
