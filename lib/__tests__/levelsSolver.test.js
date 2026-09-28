const game = require("../index.js");

const EXPECTED_SIZES = [
  [8, 10],
  [8, 10],
  [8, 10],
  [10, 12],
  [10, 12],
  [10, 12],
  [12, 14],
  [12, 14],
  [14, 16],
  [14, 16],
];

describe("10개 레벨", () => {
  it("레벨 번호와 점진적으로 커지는 패널 크기를 제공한다", () => {
    expect(game.getLevelCount()).toBe(10);
    EXPECTED_SIZES.forEach(([rows, columns], index) => {
      const state = game.initLevel(index + 1);
      expect(game.getDimensions(state)).toEqual({ rows, columns });
      expect(state.levelNumber).toBe(index + 1);
      expect(state.levelName).not.toBe("");
    });
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
  }, 30000);

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
