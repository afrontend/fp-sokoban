const DIRECTIONS = [
  { name: "up", row: -1, column: 0 },
  { name: "left", row: 0, column: -1 },
  { name: "right", row: 0, column: 1 },
  { name: "down", row: 1, column: 0 },
];

const positionKey = ({ row, column }) => `${row}:${column}`;
const add = (position, direction) => ({
  row: position.row + direction.row,
  column: position.column + direction.column,
});
const subtract = (position, direction) => ({
  row: position.row - direction.row,
  column: position.column - direction.column,
});
const isInside = (position, state) =>
  position.row >= 0 &&
  position.row < state.rows &&
  position.column >= 0 &&
  position.column < state.columns;
const toSet = (positions) => new Set(positions.map(positionKey));
const sortPositions = (positions) =>
  [...positions].sort((a, b) => a.row - b.row || a.column - b.column);

class MinHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }

  get size() {
    return this.items.length;
  }

  push(value) {
    this.items.push(value);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[parent], value) <= 0) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = value;
  }

  pop() {
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length === 0) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.items.length) break;
      const child =
        right < this.items.length &&
        this.compare(this.items[right], this.items[left]) < 0
          ? right
          : left;
      if (this.compare(this.items[child], last) >= 0) break;
      this.items[index] = this.items[child];
      index = child;
    }
    this.items[index] = last;
    return first;
  }
}

const getReachable = (state, player, crates) => {
  const walls = toSet(state.walls);
  const occupied = toSet(crates);
  const startKey = positionKey(player);
  const paths = new Map([[startKey, []]]);
  const queue = [player];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const path = paths.get(positionKey(current));
    DIRECTIONS.forEach((direction) => {
      const next = add(current, direction);
      const key = positionKey(next);
      if (
        isInside(next, state) &&
        !walls.has(key) &&
        !occupied.has(key) &&
        !paths.has(key)
      ) {
        paths.set(key, [...path, direction.name]);
        queue.push(next);
      }
    });
  }
  return paths;
};

const getStateKey = (state, player, crates) => {
  const reachable = getReachable(state, player, crates);
  const anchor = [...reachable.keys()].sort()[0];
  return `${sortPositions(crates).map(positionKey).join("|")};${anchor}`;
};

const getDeadSquares = (state) => {
  const walls = toSet(state.walls);
  const alive = toSet(state.targets);
  const queue = [...state.targets];

  for (let index = 0; index < queue.length; index += 1) {
    const box = queue[index];
    DIRECTIONS.forEach((direction) => {
      const previousBox = subtract(box, direction);
      const playerSupport = subtract(previousBox, direction);
      const previousKey = positionKey(previousBox);
      if (
        isInside(previousBox, state) &&
        isInside(playerSupport, state) &&
        !walls.has(previousKey) &&
        !walls.has(positionKey(playerSupport)) &&
        !alive.has(previousKey)
      ) {
        alive.add(previousKey);
        queue.push(previousBox);
      }
    });
  }

  const dead = new Set();
  for (let row = 0; row < state.rows; row += 1) {
    for (let column = 0; column < state.columns; column += 1) {
      const key = positionKey({ row, column });
      if (!walls.has(key) && !alive.has(key)) dead.add(key);
    }
  }
  return dead;
};

const hasBlockedSquare = (state, crates) => {
  const walls = toSet(state.walls);
  const crateSet = toSet(crates);
  const targets = toSet(state.targets);
  for (let row = 0; row < state.rows - 1; row += 1) {
    for (let column = 0; column < state.columns - 1; column += 1) {
      const square = [
        { row, column },
        { row: row + 1, column },
        { row, column: column + 1 },
        { row: row + 1, column: column + 1 },
      ];
      if (
        square.every((position) => {
          const key = positionKey(position);
          return walls.has(key) || crateSet.has(key);
        }) &&
        square.some((position) => {
          const key = positionKey(position);
          return crateSet.has(key) && !targets.has(key);
        })
      ) {
        return true;
      }
    }
  }
  return false;
};

const isDeadlocked = (state, crates, deadSquares = getDeadSquares(state)) => {
  const targets = toSet(state.targets);
  return (
    crates.some((crate) => {
      const key = positionKey(crate);
      return !targets.has(key) && deadSquares.has(key);
    }) || hasBlockedSquare(state, crates)
  );
};

const getAssignmentDistance = (crates, targets) => {
  const memo = new Map();
  const visit = (crateIndex, usedTargets) => {
    if (crateIndex === crates.length) return 0;
    const key = `${crateIndex}:${usedTargets}`;
    if (memo.has(key)) return memo.get(key);

    let best = Number.POSITIVE_INFINITY;
    targets.forEach((target, targetIndex) => {
      const mask = 1 << targetIndex;
      if ((usedTargets & mask) !== 0) return;
      const crate = crates[crateIndex];
      const distance =
        Math.abs(crate.row - target.row) +
        Math.abs(crate.column - target.column);
      best = Math.min(
        best,
        distance + visit(crateIndex + 1, usedTargets | mask),
      );
    });
    memo.set(key, best);
    return best;
  };
  return visit(0, 0);
};

const isGoal = (state, crates) => {
  const targets = toSet(state.targets);
  return crates.every((crate) => targets.has(positionKey(crate)));
};

const getPushes = (state, node, deadSquares) => {
  const reachable = getReachable(state, node.player, node.crates);
  const walls = toSet(state.walls);
  const crates = toSet(node.crates);
  const pushes = [];

  node.crates.forEach((crate, crateIndex) => {
    DIRECTIONS.forEach((direction) => {
      const playerBeforePush = subtract(crate, direction);
      const destination = add(crate, direction);
      const destinationKey = positionKey(destination);
      const walk = reachable.get(positionKey(playerBeforePush));
      if (
        walk &&
        isInside(destination, state) &&
        !walls.has(destinationKey) &&
        !crates.has(destinationKey)
      ) {
        const nextCrates = node.crates.map((item, index) =>
          index === crateIndex ? destination : item,
        );
        if (!isDeadlocked(state, nextCrates, deadSquares)) {
          pushes.push({
            player: crate,
            crates: nextCrates,
            actions: [...walk, direction.name],
          });
        }
      }
    });
  });
  return pushes;
};

const reconstruct = (nodes, goalKey) => {
  const chunks = [];
  let key = goalKey;
  while (nodes.get(key)?.previousKey) {
    const node = nodes.get(key);
    chunks.push(node.actions);
    key = node.previousKey;
  }
  return chunks.reverse().flat();
};

const evaluateDifficulty = ({ solved, pushes, explored }) => {
  if (!solved) return "unsolved";
  if (pushes <= 2 && explored < 100) return "easy";
  if (pushes <= 6 && explored < 2000) return "normal";
  if (pushes <= 12 && explored < 20000) return "hard";
  return "expert";
};

const solve = (state, options = {}) => {
  const maxNodes = options.maxNodes ?? 100000;
  const deadSquares = getDeadSquares(state);
  const initial = {
    player: state.player,
    crates: state.crates,
    pushes: 0,
    moves: 0,
    estimate: getAssignmentDistance(state.crates, state.targets),
    previousKey: null,
    actions: [],
  };

  if (isGoal(state, initial.crates)) {
    return {
      solved: true,
      actions: [],
      pushes: 0,
      moves: 0,
      explored: 0,
      difficulty: "easy",
    };
  }
  if (isDeadlocked(state, initial.crates, deadSquares)) {
    return {
      solved: false,
      actions: [],
      pushes: 0,
      moves: 0,
      explored: 0,
      difficulty: "unsolved",
    };
  }

  const compare = (a, b) =>
    a.pushes + a.estimate - (b.pushes + b.estimate) ||
    a.pushes - b.pushes ||
    a.moves - b.moves;
  const open = new MinHeap(compare);
  const initialKey = getStateKey(state, initial.player, initial.crates);
  const nodes = new Map([[initialKey, initial]]);
  const bestCosts = new Map([[initialKey, [0, 0]]]);
  open.push({ ...initial, key: initialKey });

  let explored = 0;
  while (open.size > 0 && explored < maxNodes) {
    const current = open.pop();
    const best = bestCosts.get(current.key);
    if (!best || current.pushes !== best[0] || current.moves !== best[1]) {
      continue;
    }
    explored += 1;

    if (isGoal(state, current.crates)) {
      const actions = reconstruct(nodes, current.key);
      const result = {
        solved: true,
        actions,
        pushes: current.pushes,
        moves: actions.length,
        explored,
      };
      return { ...result, difficulty: evaluateDifficulty(result) };
    }

    getPushes(state, current, deadSquares).forEach((next) => {
      const key = getStateKey(state, next.player, next.crates);
      const pushes = current.pushes + 1;
      const moves = current.moves + next.actions.length;
      const previousCost = bestCosts.get(key);
      if (
        previousCost &&
        (previousCost[0] < pushes ||
          (previousCost[0] === pushes && previousCost[1] <= moves))
      ) {
        return;
      }

      const node = {
        ...next,
        pushes,
        moves,
        estimate: getAssignmentDistance(next.crates, state.targets),
        previousKey: current.key,
      };
      bestCosts.set(key, [pushes, moves]);
      nodes.set(key, node);
      open.push({ ...node, key });
    });
  }

  const result = {
    solved: false,
    actions: [],
    pushes: 0,
    moves: 0,
    explored,
  };
  return { ...result, difficulty: evaluateDifficulty(result) };
};

const getHint = (state, options) => {
  const result = solve(state, options);
  return {
    ...result,
    direction: result.actions[0] ?? null,
  };
};

module.exports = {
  DIRECTIONS,
  getDeadSquares,
  isDeadlocked,
  getAssignmentDistance,
  evaluateDifficulty,
  solve,
  getHint,
};
