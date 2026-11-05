#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { Worker } = require("node:worker_threads");
const generator = require("../lib/generator.js");

const OPTION_NAMES = {
  rows: "rows",
  columns: "columns",
  crates: "crates",
  count: "count",
  hours: "hours",
  seed: "seed",
  workers: "workers",
  "max-nodes": "maxNodes",
  "min-pushes": "minPushes",
  "min-moves": "minMoves",
  "wall-ratio": "wallRatio",
  "reverse-steps": "reverseSteps",
  "max-attempts": "maxAttempts",
  output: "output",
};

const HELP = `
fp-sokoban 랜덤 레벨 생성기

사용법:
  npm run generate -- [옵션]

옵션:
  --rows <n>            행 수 (기본 8)
  --columns <n>         열 수 (기본 10)
  --crates <n>          상자 수 (기본 2)
  --count <n>           채택할 레벨 수 (기본 10)
  --hours <n>           최대 실행 시간 (기본 24)
  --seed <value>        재현 가능한 난수 seed
  --workers <n>         병렬 worker 수 (기본 CPU 기준 최대 4)
  --max-nodes <n>       후보당 Solver 탐색 한도 (기본 100000)
  --min-pushes <n>      최소 밀기 수 (기본 4)
  --min-moves <n>       최소 이동 수 (기본 10)
  --wall-ratio <n>      내부 벽 비율 (기본 0.3, 최대 0.3)
  --reverse-steps <n>   역방향 이동 목표 횟수 (기본 18)
  --max-attempts <n>    최대 후보 시도 수
  --output <path>       결과 JSON (기본 generated/levels.json)
  --resume              기존 결과에서 재개
  --help                도움말
`;

const parseArguments = (argv) => {
  const parsed = { resume: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--resume") parsed.resume = true;
    else if (argument === "--help") parsed.help = true;
    else if (argument.startsWith("--")) {
      const [rawName, inlineValue] = argument.slice(2).split("=", 2);
      const name = OPTION_NAMES[rawName];
      if (!name) throw new Error(`알 수 없는 옵션: --${rawName}`);
      const value = inlineValue ?? argv[++index];
      if (value === undefined) throw new Error(`--${rawName} 값이 필요합니다.`);
      parsed[name] =
        name === "seed" || name === "output" ? value : Number(value);
    } else throw new Error(`알 수 없는 인자: ${argument}`);
  }
  return parsed;
};

const writeJsonAtomic = (filePath, value) => {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
};

const readCheckpoint = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const formatDuration = (milliseconds) => {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m ${seconds % 60}s`;
};

const main = async () => {
  const cli = parseArguments(process.argv.slice(2));
  if (cli.help) {
    console.log(HELP.trim());
    return;
  }

  const output = path.resolve(cli.output ?? "generated/levels.json");
  const checkpoint = cli.resume ? readCheckpoint(output) : null;
  if (cli.resume && !checkpoint)
    throw new Error(`재개할 파일이 없습니다: ${output}`);
  const savedOptions = checkpoint?.options ?? {};
  const rawOptions = { ...savedOptions, ...cli };
  delete rawOptions.resume;
  delete rawOptions.output;
  delete rawOptions.help;
  const options = generator.normalizeOptions(rawOptions);
  const workerCount = Math.max(
    1,
    Math.min(
      4,
      cli.workers ?? savedOptions.workers ?? os.availableParallelism(),
    ),
  );
  if (!Number.isInteger(workerCount)) {
    throw new RangeError("workers는 정수여야 합니다.");
  }
  options.workers = workerCount;

  const startedAt = checkpoint?.startedAt ?? Date.now();
  const deadline = startedAt + options.hours * 60 * 60 * 1000;
  const levels = [...(checkpoint?.levels ?? [])];
  const fingerprints = new Set(levels.map((level) => level.fingerprint));
  const statistics = {
    attempts: 0,
    candidates: 0,
    accepted: levels.length,
    invalid: 0,
    unsolved: 0,
    tooEasy: 0,
    duplicates: 0,
    ...(checkpoint?.statistics ?? {}),
  };
  let stopped = false;
  let nextAttempt = statistics.attempts + 1;
  let active = 0;
  let lastSavedAt = 0;
  let lastReportedAt = 0;

  const snapshot = () => ({
    version: 1,
    seed: options.seed,
    options,
    statistics: { ...statistics, accepted: levels.length },
    startedAt,
    updatedAt: Date.now(),
    levels: [...levels].sort((a, b) => b.score - a.score),
  });
  const save = (force = false) => {
    if (!force && Date.now() - lastSavedAt < 60000) return;
    writeJsonAtomic(output, snapshot());
    lastSavedAt = Date.now();
  };
  const report = (force = false) => {
    if (!force && Date.now() - lastReportedAt < 5000) return;
    const elapsed = Date.now() - startedAt;
    const rate =
      elapsed > 0 ? (statistics.attempts / (elapsed / 1000)).toFixed(2) : "0";
    console.log(
      `[${formatDuration(elapsed)}] 시도 ${statistics.attempts}, ` +
        `Solver ${statistics.candidates}, 채택 ${levels.length}/${options.count}, ` +
        `중복 ${statistics.duplicates}, ${rate}회/초`,
    );
    lastReportedAt = Date.now();
  };
  const shouldContinue = () =>
    !stopped &&
    levels.length < options.count &&
    nextAttempt <= options.maxAttempts &&
    Date.now() < deadline;

  console.log(
    `seed=${options.seed}, ${options.rows}×${options.columns}, 상자 ${options.crates}, ` +
      `workers=${workerCount}, 출력=${output}`,
  );

  const workers = Array.from(
    { length: workerCount },
    () =>
      new Worker(path.join(__dirname, "generator-worker.js"), {
        workerData: { options },
      }),
  );

  const finish = new Promise((resolve, reject) => {
    const maybeFinish = () => {
      if (!shouldContinue() && active === 0) resolve();
    };
    const dispatch = (worker) => {
      if (!shouldContinue()) {
        maybeFinish();
        return;
      }
      const attempt = nextAttempt++;
      active += 1;
      worker.postMessage({ attempt });
    };
    workers.forEach((worker) => {
      worker.on("message", ({ attempt, map, result }) => {
        active -= 1;
        statistics.attempts = Math.max(statistics.attempts, attempt);
        if (map) statistics.candidates += 1;
        if (!result.accepted) {
          if (result.reason === "unsolved") statistics.unsolved += 1;
          else if (result.reason === "too-easy") statistics.tooEasy += 1;
          else statistics.invalid += 1;
        } else if (fingerprints.has(result.fingerprint)) {
          statistics.duplicates += 1;
        } else if (levels.length < options.count) {
          const level = {
            name: `Generated ${String(levels.length + 1).padStart(3, "0")}`,
            difficulty: result.solution.difficulty,
            minimumPushes: result.solution.pushes,
            minimumMoves: result.solution.moves,
            explored: result.solution.explored,
            score: result.score,
            fingerprint: result.fingerprint,
            map,
          };
          fingerprints.add(result.fingerprint);
          levels.push(level);
          statistics.accepted = levels.length;
          console.log(
            `채택 #${levels.length}: ${level.difficulty}, 밀기 ${level.minimumPushes}, ` +
              `이동 ${level.minimumMoves}, 점수 ${level.score}`,
          );
          save(true);
        }
        report();
        save();
        dispatch(worker);
        maybeFinish();
      });
      worker.on("error", reject);
      dispatch(worker);
    });
  });

  const stop = () => {
    stopped = true;
    console.log(
      "\n중단 요청을 받았습니다. 진행 중인 후보를 마친 뒤 저장합니다.",
    );
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await finish;
  await Promise.all(workers.map((worker) => worker.terminate()));
  save(true);
  report(true);
  console.log(`완료: ${levels.length}개 레벨을 ${output}에 저장했습니다.`);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { parseArguments, formatDuration };
