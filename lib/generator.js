const solver = require("./solver.js");

const DIRECTIONS = solver.DIRECTIONS;
const DEFAULT_GENERATOR_OPTIONS = Object.freeze({
  rows: 8,
  columns: 10,
  crates: 2,
  count: 10,
  hours: 24,
  maxNodes: 100000,
  minPushes: 4,
  minMoves: 10,
  wallRatio: 0.3,
  maxWallRatio: 0.3,
  reverseSteps: 18,
  maxAttempts: Number.POSITIVE_INFINITY,
  seed: null,
});

const positionKey = ({ row, column }) => `${row}:${column}`;
const add = (position, direction) => ({
  row: position.row + direction.row,
  column: position.column + direction.column,
});
const subtract = (position, direction) => ({
  row: position.row - direction.row,
  column: position.column - direction.column,
});
const toSet = (positions) => new Set(positions.map(positionKey));
const isInside = (position, rows, columns) =>
  position.row >= 0 &&
  position.row < rows &&
  position.column >= 0 &&
  position.column < columns;

const hashSeed = (value) => {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (seed = Date.now()) => {
  let state = hashSeed(seed) || 0x9e3779b9;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  random.int = (maximum) => Math.floor(random() * maximum);
  random.pick = (items) => items[random.int(items.length)];
  random.shuffle = (items) => {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = random.int(index + 1);
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  };
  return random;
};

const normalizeOptions = (options = {}) => {
  const normalized = { ...DEFAULT_GENERATOR_OPTIONS, ...options };
  normalized.seed ??= Date.now();
  normalized.maxAttempts ??= Number.POSITIVE_INFINITY;
  const integerFields = [
    "rows",
    "columns",
    "crates",
    "count",
    "maxNodes",
    "minPushes",
    "minMoves",
    "reverseSteps",
  ];
  integerFields.forEach((name) => {
    if (!Number.isInteger(normalized[name]) || normalized[name] < 0) {
      throw new RangeError(`${name}은 0 이상의 정수여야 합니다.`);
    }
  });
  if (normalized.rows < 5 || normalized.columns < 5) {
    throw new RangeError("생성할 레벨은 최소 5×5여야 합니다.");
  }
  if (normalized.crates < 1 || normalized.crates > 8) {
    throw new RangeError("상자 수는 1~8 사이여야 합니다.");
  }
  if (
    normalized.wallRatio < 0 ||
    normalized.wallRatio > normalized.maxWallRatio ||
    normalized.maxWallRatio > 0.5
  ) {
    throw new RangeError("벽 비율 설정이 올바르지 않습니다.");
  }
  if (!Number.isFinite(normalized.hours) || normalized.hours <= 0) {
    throw new RangeError("hours는 0보다 커야 합니다.");
  }
  if (
    normalized.maxAttempts !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(normalized.maxAttempts) || normalized.maxAttempts < 1)
  ) {
    throw new RangeError("maxAttempts는 1 이상의 정수여야 합니다.");
  }
  return normalized;
};

const getNeighbors = (position) =>
  DIRECTIONS.map((direction) => add(position, direction));

const getReachable = (start, rows, columns, walls, occupied = new Set()) => {
  const visited = new Set([positionKey(start)]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    getNeighbors(queue[index]).forEach((next) => {
      const key = positionKey(next);
      if (
        isInside(next, rows, columns) &&
        !walls.has(key) &&
        !occupied.has(key) &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push(next);
      }
    });
  }
  return visited;
};

const allInteriorPositions = (rows, columns) => {
  const positions = [];
  for (let row = 1; row < rows - 1; row += 1) {
    for (let column = 1; column < columns - 1; column += 1) {
      positions.push({ row, column });
    }
  }
  return positions;
};

const createWalls = (options, random) => {
  const { rows, columns, wallRatio } = options;
  const walls = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (
        row === 0 ||
        row === rows - 1 ||
        column === 0 ||
        column === columns - 1
      ) {
        walls.push({ row, column });
      }
    }
  }

  const interior = random.shuffle(allInteriorPositions(rows, columns));
  const desired = Math.floor(interior.length * wallRatio);
  const wallSet = toSet(walls);
  for (const candidate of interior) {
    if (wallSet.size - walls.length >= desired) break;
    wallSet.add(positionKey(candidate));
    const remaining = interior.filter(
      (position) => !wallSet.has(positionKey(position)),
    );
    if (
      remaining.length === 0 ||
      getReachable(remaining[0], rows, columns, wallSet).size !==
        remaining.length
    ) {
      wallSet.delete(positionKey(candidate));
    }
  }
  return [...wallSet].map((key) => {
    const [row, column] = key.split(":").map(Number);
    return { row, column };
  });
};

const chooseTargets = (options, walls, random) => {
  const wallSet = toSet(walls);
  const floor = allInteriorPositions(options.rows, options.columns).filter(
    (position) => !wallSet.has(positionKey(position)),
  );
  return random.shuffle(floor).slice(0, options.crates);
};

const reverseCrates = (options, walls, targets, random) => {
  let crates = targets.map((position) => ({ ...position }));
  const wallSet = toSet(walls);
  const free = allInteriorPositions(options.rows, options.columns).filter(
    (position) =>
      !wallSet.has(positionKey(position)) &&
      !toSet(crates).has(positionKey(position)),
  );
  if (free.length === 0) return null;
  let player = random.pick(free);
  let performed = 0;
  let previous = null;

  for (let step = 0; step < options.reverseSteps * 4; step += 1) {
    const crateSet = toSet(crates);
    const reachable = getReachable(
      player,
      options.rows,
      options.columns,
      wallSet,
      crateSet,
    );
    const pulls = [];
    crates.forEach((crate, crateIndex) => {
      DIRECTIONS.forEach((direction) => {
        const destination = subtract(crate, direction);
        const playerAfterPull = subtract(destination, direction);
        const destinationKey = positionKey(destination);
        const playerKey = positionKey(playerAfterPull);
        if (
          reachable.has(destinationKey) &&
          isInside(playerAfterPull, options.rows, options.columns) &&
          !wallSet.has(playerKey) &&
          !crateSet.has(playerKey)
        ) {
          const signature = `${crateIndex}:${direction.name}`;
          if (signature !== previous) {
            pulls.push({
              crateIndex,
              destination,
              player: playerAfterPull,
              signature,
            });
          }
        }
      });
    });
    if (pulls.length === 0) break;
    const pull = random.pick(pulls);
    crates = crates.map((crate, index) =>
      index === pull.crateIndex ? pull.destination : crate,
    );
    player = pull.player;
    previous = pull.signature;
    performed += 1;
    if (performed >= options.reverseSteps && random() < 0.35) break;
  }
  return performed >= options.minPushes ? { crates, player, performed } : null;
};

const stateToLevel = ({ rows, columns, walls, targets, crates, player }) => {
  const wallSet = toSet(walls);
  const targetSet = toSet(targets);
  const crateSet = toSet(crates);
  const playerKey = positionKey(player);
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => {
      const key = positionKey({ row, column });
      if (wallSet.has(key)) return "#";
      if (crateSet.has(key) && targetSet.has(key)) return "*";
      if (crateSet.has(key)) return "$";
      if (key === playerKey && targetSet.has(key)) return "+";
      if (key === playerKey) return "@";
      if (targetSet.has(key)) return ".";
      return " ";
    }).join(""),
  );
};

const generateCandidate = (rawOptions = {}, suppliedRandom) => {
  const options = normalizeOptions(rawOptions);
  const random = suppliedRandom ?? createRandom(options.seed);
  const walls = createWalls(options, random);
  const targets = chooseTargets(options, walls, random);
  if (targets.length !== options.crates) return null;
  const reversed = reverseCrates(options, walls, targets, random);
  if (!reversed) return null;
  return stateToLevel({
    rows: options.rows,
    columns: options.columns,
    walls,
    targets,
    crates: reversed.crates,
    player: reversed.player,
  });
};

const transformLevel = (level, kind) => {
  const sourceRows = level.length;
  const sourceColumns = level[0].length;
  const rotated = kind === 4 || kind === 5;
  const rows = rotated ? sourceColumns : sourceRows;
  const columns = rotated ? sourceRows : sourceColumns;
  const output = Array.from({ length: rows }, () => Array(columns));
  for (let row = 0; row < sourceRows; row += 1) {
    for (let column = 0; column < sourceColumns; column += 1) {
      let target;
      if (kind === 1) target = [row, sourceColumns - column - 1];
      else if (kind === 2) target = [sourceRows - row - 1, column];
      else if (kind === 3)
        target = [sourceRows - row - 1, sourceColumns - column - 1];
      else if (kind === 4) target = [column, sourceRows - row - 1];
      else if (kind === 5) target = [sourceColumns - column - 1, row];
      else target = [row, column];
      output[target[0]][target[1]] = level[row][column];
    }
  }
  return output.map((row) => row.join(""));
};

const canonicalizeLevel = (level) => {
  const variants = [0, 1, 2, 3];
  if (level.length === level[0].length) variants.push(4, 5);
  return variants
    .map((kind) => transformLevel(level, kind).join("\n"))
    .sort()[0];
};

const countTurns = (actions) =>
  actions
    .slice(1)
    .reduce(
      (total, direction, index) => total + Number(direction !== actions[index]),
      0,
    );

const scoreCandidate = (level, solution) => {
  const floor = level
    .join("")
    .split("")
    .filter((cell) => cell !== "#").length;
  const area = level.length * level[0].length;
  // 걷기만 긴 레벨보다 탐색량이 많고 좁은 레벨을 높게 친다.
  const openPenalty = (floor / area) * 20;
  return Number(
    (
      Math.log10(solution.explored + 1) * 10 +
      solution.pushes +
      countTurns(solution.actions) * 0.5 -
      openPenalty
    ).toFixed(2),
  );
};

const validateCandidate = (level, rawOptions = {}) => {
  const options = normalizeOptions(rawOptions);
  let state;
  try {
    const game = require("./index.js");
    state = game.init(level);
  } catch (error) {
    return { accepted: false, reason: "invalid", error: error.message };
  }
  const solution = solver.solve(state, { maxNodes: options.maxNodes });
  if (!solution.solved)
    return { accepted: false, reason: "unsolved", solution };
  if (
    solution.pushes < options.minPushes ||
    solution.moves < options.minMoves
  ) {
    return { accepted: false, reason: "too-easy", solution };
  }
  let replay = state;
  const game = require("./index.js");
  solution.actions.forEach((direction) => {
    replay = game.key(direction, replay);
  });
  if (!replay.isCleared)
    return { accepted: false, reason: "replay-failed", solution };
  return {
    accepted: true,
    solution,
    score: scoreCandidate(level, solution),
    fingerprint: canonicalizeLevel(level),
  };
};

const generateLevels = (rawOptions = {}, hooks = {}) => {
  const options = normalizeOptions(rawOptions);
  const startedAt = hooks.startedAt ?? Date.now();
  const deadline = startedAt + options.hours * 60 * 60 * 1000;
  const levels = [...(hooks.levels ?? [])];
  const fingerprints = new Set(levels.map((level) => level.fingerprint));
  const statistics = {
    attempts: 0,
    candidates: 0,
    accepted: levels.length,
    invalid: 0,
    unsolved: 0,
    tooEasy: 0,
    duplicates: 0,
    ...(hooks.statistics ?? {}),
  };

  while (
    levels.length < options.count &&
    statistics.attempts < options.maxAttempts &&
    Date.now() < deadline &&
    !hooks.shouldStop?.()
  ) {
    statistics.attempts += 1;
    const random = createRandom(`${options.seed}:${statistics.attempts}`);
    const level = generateCandidate(options, random);
    if (!level) {
      statistics.invalid += 1;
      hooks.onProgress?.({ statistics, levels, startedAt });
      continue;
    }
    statistics.candidates += 1;
    const validation = validateCandidate(level, options);
    if (!validation.accepted) {
      if (validation.reason === "too-easy") statistics.tooEasy += 1;
      else if (validation.reason === "unsolved") statistics.unsolved += 1;
      else statistics.invalid += 1;
    } else if (fingerprints.has(validation.fingerprint)) {
      statistics.duplicates += 1;
    } else {
      const number = levels.length + 1;
      const accepted = {
        name: `Generated ${String(number).padStart(3, "0")}`,
        difficulty: validation.solution.difficulty,
        minimumPushes: validation.solution.pushes,
        minimumMoves: validation.solution.moves,
        explored: validation.solution.explored,
        score: validation.score,
        fingerprint: validation.fingerprint,
        map: level,
      };
      fingerprints.add(validation.fingerprint);
      levels.push(accepted);
      statistics.accepted = levels.length;
      hooks.onAccepted?.({ level: accepted, statistics, levels, startedAt });
    }
    hooks.onProgress?.({ statistics, levels, startedAt });
  }
  return { levels, statistics, startedAt, finishedAt: Date.now(), options };
};

module.exports = {
  DEFAULT_GENERATOR_OPTIONS,
  createRandom,
  normalizeOptions,
  generateCandidate,
  validateCandidate,
  scoreCandidate,
  canonicalizeLevel,
  generateLevels,
};
