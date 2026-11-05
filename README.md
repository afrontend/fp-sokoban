# fp-sokoban

`fp-panel` 기반의 함수형 소코반 라이브러리 및 터미널 게임입니다.

![demo](https://github.com/afrontend/fp-sokoban/releases/download/demo-assets/demo.gif)

## 설치

```sh
npm install
```

## 테스트

```sh
npm test
```

## 터미널 실행

```sh
npm start
```

### 조작

| 키              | 동작                     |
| --------------- | ------------------------ |
| `←` `↑` `→` `↓` | 이동 및 상자 밀기        |
| `Space`         | 일시정지 / 재개          |
| `r`             | 레벨 다시 시작           |
| `n`             | 완료 후 다음 레벨        |
| `[` / `]`       | 이전 / 다음 레벨         |
| `?`             | 휴리스틱 AI 힌트         |
| `s` / `l`       | 빠른 저장 / 불러오기     |
| `h`             | 도움말 열기 / 닫기       |
| `Ctrl+D`        | 스냅숏 JSON 출력 후 종료 |
| `q` / `Ctrl+C`  | 종료                     |

## 문자열 레벨

```js
const level = [
  "########",
  "#      #",
  "#  .   #",
  "#  $   #",
  "#  @   #",
  "########",
];

const state = game.init(level);
```

`#`은 벽, `@`는 플레이어, `$`는 상자, `.`은 목표, `*`는 목표 위 상자, `+`는 목표 위 플레이어입니다.

## 레벨과 패널 크기

10개 레벨이 포함되어 있으며 난이도에 따라 패널이 점진적으로 커집니다.

- 레벨 1~3: `8×10`
- 레벨 4~6: `10×12`
- 레벨 7~8: `12×14`
- 레벨 9~10: `14×16`

레벨 1 은 연습용이고, 레벨 2~10 은 생성기로 만든 좁은 창고(빈 칸 43~53%)입니다.
상자는 2개(레벨 2~3)에서 5개(레벨 9~10)까지 늘어납니다.

| 레벨 | 난이도 | 상자 | 최소 밀기 |
| ---- | ------ | ---- | --------- |
| 1    | easy   | 1    | 1         |
| 2~4  | normal | 2~3  | 14~17     |
| 5~7  | hard   | 3~4  | 22~25     |
| 8~10 | expert | 4~5  | 24~28     |

```js
let state = game.initLevel(1);
state = game.nextLevel(state); // 현재 레벨을 완료한 경우에만 이동
```

## 휴리스틱 AI

A* 기반 Solver는 상자-목표 최소 배정 거리와 데드락 탐지를 사용합니다. 레벨 검증, 난이도 평가, 사용자 힌트에만 사용하며 레벨을 자동 생성하지 않습니다.

```js
const analysis = game.solve(state);
// { solved, actions, pushes, moves, explored, difficulty }

const hint = game.getHint(state);
// { ...analysis, direction: "up" }
```

### 난이도 기준

난이도는 Solver 가 답을 찾으려고 살펴본 상태 수(`explored`)로 정합니다.
밀기·이동 횟수는 판이 넓으면 고민 없이도 늘어나므로 쓰지 않습니다.

| 난이도 | `explored`          |
| ------ | ------------------- |
| easy   | 20 미만             |
| normal | 20 이상 300 미만    |
| hard   | 300 이상 5,000 미만 |
| expert | 5,000 이상          |

expert 레벨은 처음 상태에서 힌트(`?`)를 계산하는 데 몇 초 걸릴 수 있습니다.

## 랜덤 레벨 생성

완성 상태에서 상자를 역방향으로 움직여 후보를 만든 다음, 기존 Solver로
풀이 가능성과 최소 이동·밀기 횟수를 검증합니다. 기본 설정은 `8×10`, 상자
2개, 내부 벽 비율 0.3, 레벨 10개, 최대 24시간이며 CPU 코어 수에 따라 최대 4개 worker를
사용합니다.

```sh
npm run generate
```

생성 결과는 기본적으로 `generated/levels.json`에 저장됩니다. 실행 중에도
채택 시점과 1분 간격으로 체크포인트를 기록하며, `Ctrl+C`로 중단한 작업은
다음과 같이 재개할 수 있습니다.

```sh
npm run generate -- --resume
```

크기, 상자 수, 실행 시간과 품질 기준을 변경할 수도 있습니다.

```sh
npm run generate -- \
  --rows 10 \
  --columns 12 \
  --crates 3 \
  --count 20 \
  --hours 6 \
  --seed 12345 \
  --min-pushes 6 \
  --min-moves 15
```

전체 옵션은 `npm run generate -- --help`로 확인할 수 있습니다. `npm run generate`는
후보를 JSON으로만 남기므로, 내장 레벨에 반영하려면 아래 추가 파이프라인을 쓰거나
직접 `lib/levels.js`를 편집해야 합니다.

## 레벨 추가 파이프라인

생성 → 현재 코드로 재검증 → `lib/levels.js`에 append → `npm test`까지 한 번에
수행합니다. **레벨을 하나씩 추가할 때는 이 명령만 기억하면 됩니다.**

```sh
npm run add-level
```

옵션 없이 쓰면 마지막 크기 티어에 레벨 1개를 추가하며, 상자 수·난이도·최소 밀기
수는 **그 티어에 이미 있는 레벨에서 자동으로 유도**합니다. 예를 들어 14×16 티어는
기존 레벨이 `expert`이므로 `expert` 이상만 채택합니다.

추가할 자리는 티어 번호로 지정하고, 더 큰 새 티어를 만들 수도 있습니다.

```sh
npm run add-level -- --tier 2                           # 10×12 구간에 1개
npm run add-level -- --new-tier --rows 16 --columns 18   # 새 티어 신설
npm run levels:append -- --count 3                      # 여러 개 한 번에
```

미리 확인하려면 `--dry-run`을 붙입니다.

```sh
npm run add-level -- --dry-run
```

파이프라인은 다음을 보장합니다.

- 대상 티어의 크기로만 생성하므로 `8×10 → 14×16` 난이도 곡선이 깨지지 않는다
- 기존 레벨과 회전·반전까지 비교해 중복을 제거한다
- 생성기 결과를 믿지 않고 현재 `lib`으로 다시 파싱·풀이·재생해 검증한다
- `id` 재부여, `SIZE_TIERS` 갱신, Prettier 포맷, `npm test`를 자동 수행한다
- 요청한 수를 채우지 못하면 파일을 쓰지 않고 실패한다

이미 만들어 둔 후보 JSON을 재사용할 수도 있습니다.

```sh
npm run levels:append -- --tier 1 --count 2 --candidates generated/levels.json --dry-run
```

전체 옵션은 `npm run add-level -- --help`로 확인하세요.

### 난이도를 올리는 방법

난이도는 탐색량으로 정해지므로 **판을 좁히고(`--wall-ratio`, 기본이자 최대 0.3)
상자를 늘리는 쪽**이 효과적입니다. 밀기 횟수만 늘리면 걷는 거리만 길어집니다.
벽 비율 0.3 으로 8분 동안 생성했을 때 원하는 등급의 후보 수는 다음과 같습니다.

| 크기·상자       | 등급   | 8분간 후보 수 |
| --------------- | ------ | ------------- |
| 10×12, 상자 3개 | hard   | 8개 이상      |
| 12×14, 상자 4개 | expert | 4~5개         |
| 14×16, 상자 5개 | expert | 8개 이상      |

expert 는 드물게 나오므로 `--minutes` 를 넉넉히 줍니다.

## API 예시

```js
const game = require("fp-sokoban");

let state = game.init(level);
state = game.key("up", state);
const panel = game.join(state);

const snapshot = game.serializeState(state);
state = game.restoreState(snapshot);
```

자세한 설계는 [PLAN.md](PLAN.md)를 참고하세요.

## Demo GIF 업데이트

터미널 동작 미리보기를 자동으로 재생성합니다.

```sh
# 의존 도구 설치 (최초 1회)
brew install asciinema
brew install agg
brew install gh && gh auth login

# 데모 생성 및 GitHub Releases 업로드
npm run demo-gif
```

`npm run demo-gif` 실행 순서:

1. `scripts/autoplay.js` — 내장 A* Solver 로 레벨 1–7 을 차례로 풀고 자동 종료
2. `asciinema rec` — 터미널 출력을 `demo.cast`로 녹화
3. `agg` — `demo.cast` → `demo.gif` 변환
4. `gh release upload` — GitHub Releases `demo-assets` 태그에 업로드
5. `README.md` — GIF URL을 GitHub Releases 경로로 교체

main 브랜치에 푸시하면 `.github/workflows/demo.yml`이 위 과정을 자동으로 실행합니다.

## License

MIT
