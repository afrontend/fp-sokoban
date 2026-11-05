#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const generator = require("../lib/generator.js");
const solver = require("../lib/solver.js");
const game = require("../lib/index.js");
const { LEVELS, SIZE_TIERS } = require("../lib/levels.js");

const ROOT = path.resolve(__dirname, "..");
const LEVELS_PATH = path.join(ROOT, "lib", "levels.js");

// 생성 단계에서 먼저 거르는 최소 밀기 수. 난이도는 탐색량(evaluateDifficulty)
// 으로 정해지므로 여기서는 너무 짧은 후보만 버린다.
const DIFFICULTY_FLOORS = { easy: 1, normal: 2, hard: 4, expert: 6 };
const DIFFICULTY_RANKS = ["easy", "normal", "hard", "expert"];

const rankOf = (difficulty) => DIFFICULTY_RANKS.indexOf(difficulty);

// 대상 티어에 이미 있는 레벨 중 가장 쉬운 난이도. 새로 넣는 레벨이 그보다
// 쉬워지지 않게 하는 하한선으로 쓴다.
const getTierFloor = (existing) => {
  const ranks = existing
    .map((level) => rankOf(level.difficulty))
    .filter((rank) => rank >= 0);
  return ranks.length > 0 ? DIFFICULTY_RANKS[Math.min(...ranks)] : "normal";
};

const OPTION_NAMES = {
  count: "count",
  tier: "tier",
  rows: "rows",
  columns: "columns",
  crates: "crates",
  difficulty: "difficulty",
  minutes: "minutes",
  seed: "seed",
  name: "name",
  "min-pushes": "minPushes",
  "min-moves": "minMoves",
  "wall-ratio": "wallRatio",
  "reverse-steps": "reverseSteps",
  "max-nodes": "maxNodes",
  candidates: "candidates",
  audit: "audit",
};

const NUMBER_OPTIONS = new Set([
  "count",
  "tier",
  "rows",
  "columns",
  "crates",
  "minutes",
  "minPushes",
  "minMoves",
  "wallRatio",
  "reverseSteps",
  "maxNodes",
]);

const FLAGS = {
  "--dry-run": "dryRun",
  "--skip-test": "skipTest",
  "--new-tier": "newTier",
  "--help": "help",
};

const HELP = `
fp-sokoban 레벨 추가 파이프라인

  생성 → 현재 코드로 검증 → lib/levels.js 에 append → npm test

사용법:
  npm run add-level                 레벨 1개 추가 (가장 짧은 형태)
  npm run add-level -- [옵션]
  npm run levels:append -- [옵션]   여러 개 추가할 때

대상 지정:
  --tier <n>            추가할 티어 번호 (1부터, 기본: 마지막 티어)
  --new-tier            마지막 티어보다 큰 새 티어를 만든다 (--rows/--columns 필요)
  --rows <n>            새 티어의 행 수 (--new-tier 와 함께)
  --columns <n>         새 티어의 열 수 (--new-tier 와 함께)
  --count <n>           추가할 레벨 수 (기본 1)

난이도:
  --difficulty <등급>   easy|normal|hard|expert — 이 등급만 채택한다
                        (기본: 대상 티어의 기존 난이도를 하한으로 사용)
  --crates <n>          상자 수 (기본: 대상 티어의 최대 상자 수)
  --min-pushes <n>      최소 밀기 수 (기본: easy 1·normal 2·hard 4·expert 6)
  --min-moves <n>       최소 이동 수
  --reverse-steps <n>   역방향 당기기 목표 횟수 (기본: min-pushes 기준 자동)
  --wall-ratio <n>      내부 벽 비율 (기본 0.3, 최대 0.3)

실행:
  --minutes <n>         생성 시간 예산 (기본 10)
  --seed <value>        재현 가능한 난수 seed
  --max-nodes <n>       후보당 Solver 탐색 한도 (기본 100000)
  --name "<형식>"       레벨 이름 형식, {id} 치환 (기본 "자동 생성 {id}")
  --candidates <path>   생성을 건너뛰고 기존 JSON 에서 후보를 고른다
  --audit <path>        채택 후보 JSON 저장 위치 (기본 generated/append-<크기>.json)
  --dry-run             파일을 쓰지 않고 추가될 내용만 출력
  --skip-test           append 후 npm test 를 돌리지 않는다
  --help                도움말

난이도를 올리려면 --min-pushes 보다 --crates 를 늘리는 쪽이 효과적이다.
역방향 당기기를 깊게 해도 Solver 가 짧은 최적해를 찾으면 too-easy 로 걸러진다.
`;

const parseArguments = (argv) => {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (FLAGS[argument]) {
      parsed[FLAGS[argument]] = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new Error(`알 수 없는 인자: ${argument}`);
    }
    const [rawName, inlineValue] = argument.slice(2).split("=", 2);
    const name = OPTION_NAMES[rawName];
    if (!name) throw new Error(`알 수 없는 옵션: --${rawName}`);
    const value = inlineValue ?? argv[++index];
    if (value === undefined) throw new Error(`--${rawName} 값이 필요합니다.`);
    if (NUMBER_OPTIONS.has(name)) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        throw new Error(`--${rawName} 는 숫자여야 합니다: ${value}`);
      }
      parsed[name] = numeric;
    } else {
      parsed[name] = value;
    }
  }
  return parsed;
};

const countCrates = (map) =>
  map
    .join("")
    .split("")
    .filter((cell) => cell === "$" || cell === "*").length;

const getTierRange = (tierIndex) => {
  const start = SIZE_TIERS.slice(0, tierIndex).reduce(
    (total, tier) => total + tier.levels,
    0,
  );
  return { start: start + 1, end: start + SIZE_TIERS[tierIndex].levels };
};

// 추가할 자리(티어)와 생성 옵션을 확정한다.
const resolveTarget = (cli) => {
  if (cli.newTier) {
    if (!Number.isInteger(cli.rows) || !Number.isInteger(cli.columns)) {
      throw new Error("--new-tier 는 --rows 와 --columns 가 필요합니다.");
    }
    const last = SIZE_TIERS[SIZE_TIERS.length - 1];
    if (
      cli.rows < last.rows ||
      cli.columns < last.columns ||
      cli.rows * cli.columns <= last.rows * last.columns
    ) {
      throw new Error(
        `새 티어는 마지막 티어(${last.rows}×${last.columns})보다 커야 합니다.`,
      );
    }
    return {
      isNewTier: true,
      tierIndex: SIZE_TIERS.length,
      rows: cli.rows,
      columns: cli.columns,
      existing: [],
      insertAfter: LEVELS.length,
    };
  }

  const tierIndex = (cli.tier ?? SIZE_TIERS.length) - 1;
  if (!Number.isInteger(tierIndex) || tierIndex < 0) {
    throw new Error("--tier 는 1 이상의 정수여야 합니다.");
  }
  if (tierIndex >= SIZE_TIERS.length) {
    throw new Error(
      `티어는 1~${SIZE_TIERS.length} 사이입니다. 새 티어는 --new-tier 를 쓰세요.`,
    );
  }
  const tier = SIZE_TIERS[tierIndex];
  if (cli.rows !== undefined || cli.columns !== undefined) {
    if (cli.rows !== tier.rows || cli.columns !== tier.columns) {
      throw new Error(
        `티어 ${tierIndex + 1}의 크기는 ${tier.rows}×${tier.columns} 입니다.`,
      );
    }
  }
  const { start, end } = getTierRange(tierIndex);
  return {
    isNewTier: false,
    tierIndex,
    rows: tier.rows,
    columns: tier.columns,
    existing: LEVELS.slice(start - 1, end),
    insertAfter: end,
  };
};

const resolveGeneratorOptions = (cli, target, count) => {
  const difficulty = cli.difficulty;
  if (difficulty && !DIFFICULTY_FLOORS[difficulty]) {
    throw new Error(
      `--difficulty 는 ${Object.keys(DIFFICULTY_FLOORS).join("|")} 중 하나입니다.`,
    );
  }

  const crateCounts = target.existing.map((level) => countCrates(level.map));
  const crates =
    cli.crates ?? (crateCounts.length > 0 ? Math.max(...crateCounts) : 3);
  // --difficulty 는 정확히 그 등급만, 없으면 티어의 기존 난이도를 하한으로 쓴다.
  const floor = difficulty ?? getTierFloor(target.existing);
  const minPushes = cli.minPushes ?? DIFFICULTY_FLOORS[floor];
  const minMoves = cli.minMoves ?? Math.max(minPushes * 2, 10);
  // 역방향 당기기가 minPushes 보다 얕으면 조건을 만족하는 후보가 아예 나오지 않는다.
  const reverseSteps =
    cli.reverseSteps ??
    Math.max(
      generator.DEFAULT_GENERATOR_OPTIONS.reverseSteps,
      Math.ceil(minPushes * 1.75),
    );

  return {
    options: {
      rows: target.rows,
      columns: target.columns,
      crates,
      count,
      minPushes,
      minMoves,
      reverseSteps,
      wallRatio: cli.wallRatio ?? generator.DEFAULT_GENERATOR_OPTIONS.wallRatio,
      maxNodes: cli.maxNodes ?? generator.DEFAULT_GENERATOR_OPTIONS.maxNodes,
      hours: (cli.minutes ?? 10) / 60,
      seed: cli.seed ?? String(Date.now()),
    },
    floor,
    exact: Boolean(difficulty),
  };
};

// 난이도 수용 조건. --difficulty 는 정확히 일치, 아니면 티어 하한 이상.
const createFilter = ({ floor, exact }) => ({
  label: exact ? `난이도 ${floor}만` : `난이도 ${floor} 이상`,
  accepts: (candidate) =>
    exact
      ? candidate.difficulty === floor
      : rankOf(candidate.difficulty) >= rankOf(floor),
});

const formatDuration = (milliseconds) => {
  const seconds = Math.round(milliseconds / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const loadCandidates = (filePath, target, wanted, filter) => {
  const resolved = path.resolve(filePath);
  const data = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const pool = Array.isArray(data) ? data : (data.levels ?? []);
  const matching = pool.filter(
    (level) =>
      Array.isArray(level.map) &&
      level.map.length === target.rows &&
      level.map[0].length === target.columns &&
      filter.accepts(level),
  );
  console.log(
    `${resolved} 에서 후보 ${pool.length}개 중 ` +
      `${target.rows}×${target.columns}, ${filter.label} 조건에 맞는 ` +
      `${matching.length}개를 읽었습니다.`,
  );
  return matching.slice(0, wanted * 4);
};

const generateCandidates = (options, wanted, filter) => {
  // 기존 레벨의 지문을 미리 넣어 회전·반전 중복까지 함께 걸러낸다.
  const seeded = LEVELS.map((level) => ({
    fingerprint: generator.canonicalizeLevel(level.map),
  }));
  const margin = Math.max(2, Math.ceil(wanted / 2));
  // generateLevels 의 내부 카운트는 난이도 필터를 모른다. 어려운 등급은 드물게
  // 나오므로 개수로 끊지 않고 shouldStop 과 시간 예산으로만 끝낸다.
  const request = {
    ...options,
    count: Number.MAX_SAFE_INTEGER,
  };

  console.log(
    `생성: ${options.rows}×${options.columns}, 상자 ${options.crates}, ` +
      `최소 밀기 ${options.minPushes}, 최소 이동 ${options.minMoves}, ` +
      `reverseSteps ${options.reverseSteps}, ${filter.label}, seed=${options.seed}`,
  );

  const startedAt = Date.now();
  let lastReport = 0;
  const accepted = [];
  const result = generator.generateLevels(request, {
    levels: seeded,
    onAccepted: ({ level }) => {
      if (!filter.accepts(level)) return;
      accepted.push(level);
      console.log(
        `  후보 ${accepted.length}: ${level.difficulty}, ` +
          `밀기 ${level.minimumPushes}, 이동 ${level.minimumMoves}, 점수 ${level.score}`,
      );
    },
    onProgress: ({ statistics }) => {
      if (Date.now() - lastReport < 5000) return;
      lastReport = Date.now();
      console.log(
        `  [${formatDuration(Date.now() - startedAt)}] 시도 ${statistics.attempts}, ` +
          `Solver ${statistics.candidates}, too-easy ${statistics.tooEasy}, ` +
          `채택 ${accepted.length}/${wanted}`,
      );
    },
    shouldStop: () => accepted.length >= wanted + margin,
  });

  console.log(
    `생성 종료 (${formatDuration(Date.now() - startedAt)}): ` +
      JSON.stringify(result.statistics),
  );
  return accepted;
};

// 생성기 말을 믿지 않고 현재 lib 으로 다시 파싱·풀이·재생한다.
const verify = (candidate, target, maxNodes) => {
  let state;
  try {
    state = game.init(candidate.map);
  } catch (error) {
    return { ok: false, reason: `init 실패: ${error.message}` };
  }
  const size = game.getDimensions(state);
  if (size.rows !== target.rows || size.columns !== target.columns) {
    return {
      ok: false,
      reason: `크기 불일치: ${size.rows}×${size.columns}`,
    };
  }

  const startedAt = Date.now();
  const solution = solver.solve(state, { maxNodes });
  const solveMs = Date.now() - startedAt;
  if (!solution.solved) return { ok: false, reason: "풀이 불가" };

  let replay = state;
  solution.actions.forEach((direction) => {
    replay = game.key(direction, replay);
  });
  if (!replay.isCleared) return { ok: false, reason: "재생 실패" };
  if (replay.pushes !== solution.pushes) {
    return { ok: false, reason: "밀기 수 불일치" };
  }

  return { ok: true, solution, solveMs };
};

const serializeLevel = (level) =>
  [
    "  {",
    `    id: ${level.id},`,
    `    name: ${JSON.stringify(level.name)},`,
    `    difficulty: ${JSON.stringify(level.difficulty)},`,
    `    minimumPushes: ${level.minimumPushes},`,
    `    minimumMoves: ${level.minimumMoves},`,
    "    map: [",
    ...level.map.map((row) => `      ${JSON.stringify(row)},`),
    "    ],",
    "  },",
  ].join("\n");

const serializeTiers = (tiers) =>
  [
    "const SIZE_TIERS = [",
    ...tiers.map(
      (tier) =>
        `  { rows: ${tier.rows}, columns: ${tier.columns}, levels: ${tier.levels} },`,
    ),
    "];",
  ].join("\n");

// 1열의 `];` 로 끝나는 최상위 배열 리터럴을 찾아 교체한다.
const replaceArrayBlock = (source, declaration, replacement) => {
  const start = source.indexOf(declaration);
  if (start === -1) throw new Error(`${declaration} 를 찾지 못했습니다.`);
  const terminator = source.indexOf("\n];", start);
  if (terminator === -1) {
    throw new Error(`${declaration} 의 끝(];)을 찾지 못했습니다.`);
  }
  return (
    source.slice(0, start) +
    replacement +
    source.slice(terminator + "\n];".length)
  );
};

const applyAppend = (accepted, target) => {
  const source = fs.readFileSync(LEVELS_PATH, "utf8");

  const renumbered = LEVELS.map((level, index) => ({
    ...level,
    id: index + 1,
  }));
  const merged = [
    ...renumbered.slice(0, target.insertAfter),
    ...accepted,
    ...renumbered.slice(target.insertAfter),
  ].map((level, index) => ({ ...level, id: index + 1 }));

  const tiers = SIZE_TIERS.map((tier) => ({ ...tier }));
  if (target.isNewTier) {
    tiers.push({
      rows: target.rows,
      columns: target.columns,
      levels: accepted.length,
    });
  } else {
    tiers[target.tierIndex].levels += accepted.length;
  }

  const withLevels = replaceArrayBlock(
    source,
    "const LEVELS = [",
    ["const LEVELS = [", ...merged.map(serializeLevel), "];"].join("\n"),
  );
  const withTiers = replaceArrayBlock(
    withLevels,
    "const SIZE_TIERS = [",
    serializeTiers(tiers),
  );
  return { contents: withTiers, merged, tiers };
};

const runCommand = (command, args) => {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
};

const main = () => {
  const cli = parseArguments(process.argv.slice(2));
  if (cli.help) {
    console.log(HELP.trim());
    return 0;
  }

  const wanted = cli.count ?? 1;
  if (!Number.isInteger(wanted) || wanted < 1) {
    throw new Error("--count 는 1 이상의 정수여야 합니다.");
  }

  const target = resolveTarget(cli);
  const resolved = resolveGeneratorOptions(cli, target, wanted);
  const options = resolved.options;
  const filter = createFilter(resolved);
  const label = target.isNewTier
    ? `새 티어 ${SIZE_TIERS.length + 1}`
    : `티어 ${target.tierIndex + 1}`;
  console.log(
    `대상: ${label} (${target.rows}×${target.columns}), ` +
      `레벨 ${target.insertAfter} 뒤에 ${wanted}개 추가\n`,
  );

  const pool = cli.candidates
    ? loadCandidates(cli.candidates, target, wanted, filter)
    : generateCandidates(options, wanted, filter);

  console.log("\n현재 코드로 후보를 재검증합니다.");
  const fingerprints = new Set(
    LEVELS.map((level) => generator.canonicalizeLevel(level.map)),
  );
  const verified = [];
  let slowestSolveMs = 0;
  for (const candidate of [...pool].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0),
  )) {
    if (verified.length >= wanted) break;
    const fingerprint = generator.canonicalizeLevel(candidate.map);
    if (fingerprints.has(fingerprint)) {
      console.log("  건너뜀: 기존 레벨과 중복(회전·반전 포함)");
      continue;
    }
    const result = verify(candidate, target, options.maxNodes);
    if (!result.ok) {
      console.log(`  탈락: ${result.reason}`);
      continue;
    }
    if (!filter.accepts(result.solution)) {
      console.log(
        `  탈락: 재검증 난이도 ${result.solution.difficulty} (${filter.label})`,
      );
      continue;
    }
    fingerprints.add(fingerprint);
    slowestSolveMs = Math.max(slowestSolveMs, result.solveMs);
    verified.push({
      difficulty: result.solution.difficulty,
      minimumPushes: result.solution.pushes,
      minimumMoves: result.solution.moves,
      map: candidate.map,
      score: candidate.score ?? null,
      solveMs: result.solveMs,
    });
    console.log(
      `  통과: ${result.solution.difficulty}, 밀기 ${result.solution.pushes}, ` +
        `이동 ${result.solution.moves}, 풀이 ${result.solveMs}ms`,
    );
  }

  if (verified.length < wanted) {
    console.error(
      `\n검증을 통과한 레벨이 ${verified.length}개로 요청한 ${wanted}개보다 적습니다.`,
    );
    console.error(
      "--minutes 를 늘리거나, --min-pushes 를 낮추거나, --crates 를 조정해 다시 시도하세요.",
    );
    return 1;
  }

  const nameTemplate = cli.name ?? "자동 생성 {id}";
  const accepted = verified.map((level, index) => ({
    ...level,
    id: target.insertAfter + index + 1,
    name: nameTemplate.replace("{id}", String(target.insertAfter + index + 1)),
  }));

  const auditPath = path.resolve(
    cli.audit ??
      path.join(
        ROOT,
        "generated",
        `append-${target.rows}x${target.columns}.json`,
      ),
  );
  const { contents, merged, tiers } = applyAppend(accepted, target);

  console.log("\n추가될 레벨:");
  accepted.forEach((level) => {
    console.log(
      `  ${level.id}. ${level.name} — ${level.difficulty}, ` +
        `밀기 ${level.minimumPushes}, 이동 ${level.minimumMoves}`,
    );
    level.map.forEach((row) => console.log(`     ${row}`));
  });
  console.log(
    `\n레벨 수: ${LEVELS.length} → ${merged.length}, ` +
      `티어: ${tiers.map((tier) => `${tier.rows}×${tier.columns}:${tier.levels}`).join(", ")}`,
  );

  if (cli.dryRun) {
    console.log("\n--dry-run 이므로 파일을 쓰지 않았습니다.");
    return 0;
  }

  fs.mkdirSync(path.dirname(auditPath), { recursive: true });
  fs.writeFileSync(
    auditPath,
    `${JSON.stringify({ version: 1, options, accepted }, null, 2)}\n`,
  );
  fs.writeFileSync(LEVELS_PATH, contents);
  console.log(`\n${LEVELS_PATH} 를 수정했습니다. 감사 기록: ${auditPath}`);

  const formatStatus = runCommand("npx", ["prettier", "--write", LEVELS_PATH]);
  if (formatStatus !== 0) {
    console.error("prettier 포맷에 실패했습니다. lib/levels.js 를 확인하세요.");
    return formatStatus;
  }

  if (cli.skipTest) {
    console.log("\n--skip-test 이므로 npm test 를 건너뜁니다.");
    return 0;
  }

  const testStatus = runCommand("npm", ["test"]);
  if (testStatus !== 0) {
    console.error(
      "\nnpm test 가 실패했습니다. git checkout lib/levels.js 로 되돌릴 수 있습니다.",
    );
    return testStatus;
  }

  if (slowestSolveMs > 5000) {
    console.warn(
      `\n경고: 가장 느린 레벨 풀이가 ${slowestSolveMs}ms 입니다. ` +
        "레벨이 늘어나면 levelsSolver.test.js 의 타임아웃을 올려야 할 수 있습니다.",
    );
  }
  console.log(`\n완료: 레벨 ${accepted.length}개를 추가했습니다.`);
  return 0;
};

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { parseArguments, resolveTarget, serializeLevel, countCrates };
