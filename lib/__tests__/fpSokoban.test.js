const game = require("../index.js");

const SIMPLE_LEVEL = ["######", "#    #", "# @$.#", "#    #", "######"];

const BLOCKED_LEVEL = ["#######", "#     #", "# @$$.#", "#   . #", "#######"];

describe("parseLevel", () => {
  it("문자열 맵에서 게임 요소를 파싱한다", () => {
    const parsed = game.parseLevel(SIMPLE_LEVEL);
    expect(parsed.rows).toBe(5);
    expect(parsed.columns).toBe(6);
    expect(parsed.player).toEqual({ row: 2, column: 2 });
    expect(parsed.crates).toEqual([{ row: 2, column: 3 }]);
    expect(parsed.targets).toEqual([{ row: 2, column: 4 }]);
  });

  it("목표 위 상자(*)와 목표 위 플레이어(+)를 지원한다", () => {
    const crateOnTarget = game.parseLevel(["#####", "# *@#", "#####"]);
    expect(crateOnTarget.crates).toEqual([{ row: 1, column: 2 }]);
    expect(crateOnTarget.targets).toEqual([{ row: 1, column: 2 }]);

    const playerOnTarget = game.parseLevel(["#####", "#$+ #", "#####"]);
    expect(playerOnTarget.targets).toEqual([{ row: 1, column: 2 }]);
    expect(playerOnTarget.player).toEqual({ row: 1, column: 2 });
  });

  it("잘못된 맵을 거부한다", () => {
    expect(() => game.parseLevel(["###", "#@"])).toThrow(
      "모든 행 길이는 같아야",
    );
    expect(() => game.parseLevel(["###", "#@#", "###"])).toThrow(
      "상자($)가 필요",
    );
    expect(() => game.parseLevel(["####", "#@$#", "####"])).toThrow(
      "상자와 목표 지점의 수가 같아야",
    );
  });
});

describe("init", () => {
  it("문자열 맵으로 초기 상태와 패널을 생성한다", () => {
    const state = game.init(SIMPLE_LEVEL);
    expect(game.getDimensions(state)).toEqual({ rows: 5, columns: 6 });
    expect(game.toArray(state)).toHaveLength(4);
    expect(state.moves).toBe(0);
    expect(state.pushes).toBe(0);
    expect(state.isCleared).toBe(false);
  });

  it("객체 및 기존 위치 인자 형식을 지원한다", () => {
    expect(game.init({ level: SIMPLE_LEVEL }).rows).toBe(5);
    expect(game.init(5, 6, SIMPLE_LEVEL).columns).toBe(6);
  });

  it("명시한 크기와 문자열 맵 크기가 다르면 거부한다", () => {
    expect(() =>
      game.init({ rows: 8, columns: 8, level: SIMPLE_LEVEL }),
    ).toThrow("문자열 레벨 크기와 일치");
  });
});

describe("key", () => {
  it("빈 공간으로 이동하며 원본 상태를 변경하지 않는다", () => {
    const state = game.init(SIMPLE_LEVEL);
    const next = game.key("up", state);
    expect(next.player).toEqual({ row: 1, column: 2 });
    expect(next.moves).toBe(1);
    expect(state.player).toEqual({ row: 2, column: 2 });
  });

  it("벽을 통과하지 않는다", () => {
    const state = game.init(SIMPLE_LEVEL);
    const next = game.key("left", game.key("left", state));
    expect(next.player).toEqual({ row: 2, column: 1 });
    expect(next.moves).toBe(1);
  });

  it("상자를 목표로 밀고 즉시 클리어를 판정한다", () => {
    const state = game.init(SIMPLE_LEVEL);
    const next = game.key("right", state);
    expect(next.player).toEqual({ row: 2, column: 3 });
    expect(next.crates).toEqual([{ row: 2, column: 4 }]);
    expect(next.moves).toBe(1);
    expect(next.pushes).toBe(1);
    expect(next.isCleared).toBe(true);
  });

  it("벽이나 다른 상자 쪽으로 상자를 밀 수 없다", () => {
    const state = game.init(BLOCKED_LEVEL);
    const next = game.key("right", state);
    expect(next).toBe(state);
  });

  it("일시정지 중에는 이동하지 않는다", () => {
    const state = game.init(SIMPLE_LEVEL);
    const paused = game.key("space", state);
    expect(paused.paused).toBe(true);
    expect(paused.pause).toBe(true);
    expect(game.key("up", paused)).toBe(paused);
    expect(game.key("space", paused).paused).toBe(false);
  });
});

describe("rendering", () => {
  it("목표 위 상자를 노란색으로 표시한다", () => {
    const state = game.key("right", game.init(SIMPLE_LEVEL));
    expect(game.join(state)[2][4].color).toBe(game.COLORS.crateOnTarget);
  });

  it("toArray는 원본과 분리된 복사본을 반환한다", () => {
    const state = game.init(SIMPLE_LEVEL);
    const panels = game.toArray(state);
    panels[0][0][0].color = "red";
    expect(state.wallPanel[0][0].color).toBe(game.COLORS.wall);
  });

  it("turn 기반 게임의 tick은 상태를 변경하지 않는다", () => {
    const state = game.init(SIMPLE_LEVEL);
    expect(game.tick(state)).toBe(state);
    expect(game.getTickInterval(state)).toBeNull();
  });
});

describe("snapshot", () => {
  it("JSON 왕복 가능한 버전 스냅숏을 복원한다", () => {
    const state = game.key("up", game.init(SIMPLE_LEVEL));
    const snapshot = JSON.parse(JSON.stringify(game.serializeState(state)));
    const restored = game.restoreState(snapshot);
    expect(snapshot.game).toBe("fp-sokoban");
    expect(snapshot.version).toBe(1);
    expect(restored.player).toEqual(state.player);
    expect(restored.wallPanel).toEqual(state.wallPanel);
  });

  it("다른 게임 및 버전의 스냅숏을 거부한다", () => {
    expect(() =>
      game.restoreState({ game: "fp-snake", version: 1, state: {} }),
    ).toThrow("fp-sokoban 스냅숏이 아닙니다");
    expect(() =>
      game.restoreState({ game: "fp-sokoban", version: 2, state: {} }),
    ).toThrow("지원하지 않는 스냅숏 버전");
  });
});
