# fp-sokoban

`fp-panel` 기반의 함수형 소코반 라이브러리 및 터미널 게임입니다.

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

## 랜덤 레벨 생성

완성 상태에서 상자를 역방향으로 움직여 후보를 만든 다음, 기존 Solver로
풀이 가능성과 최소 이동·밀기 횟수를 검증합니다. 기본 설정은 `8×10`, 상자
2개, 레벨 10개, 최대 24시간이며 CPU 코어 수에 따라 최대 4개 worker를
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

전체 옵션은 `npm run generate -- --help`로 확인할 수 있습니다. 생성 결과는
자동으로 내장 레벨에 등록되지 않으므로, 플레이 테스트를 거친 뒤
`lib/levels.js`에 선별하여 추가해야 합니다.

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
