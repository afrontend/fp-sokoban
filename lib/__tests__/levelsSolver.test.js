const game = require("../index.js");

describe("내장 레벨", () => {
  it("크기 티어의 합이 전체 레벨 수와 같다", () => {
    const declared = game.SIZE_TIERS.reduce(
      (total, tier) => total + tier.levels,
      0,
    );
    expect(game.getLevelCount()).toBeGreaterThanOrEqual(10);
    expect(declared).toBe(game.getLevelCount());
  });

  it("티어를 지날수록 패널이 커진다", () => {
    game.SIZE_TIERS.forEach((tier, index) => {
      expect(tier.levels).toBeGreaterThan(0);
      if (index === 0) return;
      const previous = game.SIZE_TIERS[index - 1];
      expect(tier.rows).toBeGreaterThanOrEqual(previous.rows);
      expect(tier.columns).toBeGreaterThanOrEqual(previous.columns);
      expect(tier.rows * tier.columns).toBeGreaterThan(
        previous.rows * previous.columns,
      );
    });
  });

  it("레벨 번호와 티어 크기가 일치한다", () => {
    for (
      let levelNumber = 1;
      levelNumber <= game.getLevelCount();
      levelNumber += 1
    ) {
      const state = game.initLevel(levelNumber);
      expect(game.getDimensions(state), `레벨 ${levelNumber}`).toEqual(
        game.getExpectedSize(levelNumber),
      );
      expect(state.levelNumber).toBe(levelNumber);
      expect(state.levelName).not.toBe("");
      expect(game.getLevel(levelNumber).id).toBe(levelNumber);
    }
  });

  it("모든 레벨을 휴리스틱 AI로 해결할 수 있다", () => {
    for (
      let levelNumber = 1;
      levelNumber <= game.getLevelCount();
      levelNumber += 1
    ) {
      const state = game.initLevel(levelNumber);
      const result = game.solve(state);
      expect(result.solved, `레벨 ${levelNumber}`).toBe(true);
      expect(result.pushes, `레벨 ${levelNumber}`).toBe(state.minimumPushes);
      expect(result.moves, `레벨 ${levelNumber}`).toBe(state.minimumMoves);
      expect(result.difficulty, `레벨 ${levelNumber}`).toBe(state.difficulty);
    }
  }, 120000);

  it("Solver의 해답을 적용하면 레벨이 클리어된다", () => {
    let state = game.initLevel(6);
    const solution = game.solve(state);
    solution.actions.forEach((direction) => {
      state = game.key(direction, state);
    });
    expect(state.isCleared).toBe(true);
    expect(state.pushes).toBe(solution.pushes);
  });

  it("완료 후에만 다음 레벨로 이동한다", () => {
    const state = game.initLevel(1);
    expect(game.nextLevel(state)).toBe(state);

    const cleared = game.key("up", state);
    const next = game.nextLevel(cleared);
    expect(next.levelNumber).toBe(2);
    expect(next.moves).toBe(0);
  });
});

describe("데드락과 힌트", () => {
  it("목표가 아닌 모서리에 갇힌 상자를 데드락으로 판정한다", () => {
    const state = game.init(["#####", "#$ @#", "# . #", "#####"]);
    expect(game.isDeadlocked(state, state.crates)).toBe(true);
    expect(game.solve(state).solved).toBe(false);
  });

  it("현재 상태에서 첫 번째 이동 힌트를 제공한다", () => {
    const state = game.initLevel(3);
    const hint = game.getHint(state);
    expect(hint.solved).toBe(true);
    expect(["left", "up", "right", "down"]).toContain(hint.direction);
    expect(hint.pushes).toBe(state.minimumPushes);
  });
});
