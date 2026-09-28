const game = require("../index.js");
const generator = require("../generator.js");

describe("랜덤 레벨 생성기", () => {
  const options = {
    rows: 8,
    columns: 10,
    crates: 2,
    count: 1,
    hours: 0.01,
    maxAttempts: 100,
    minPushes: 4,
    minMoves: 10,
    seed: "generator-test",
  };

  it("같은 seed로 같은 후보를 생성한다", () => {
    const first = generator.generateCandidate(options);
    const second = generator.generateCandidate(options);
    expect(second).toEqual(first);
    expect(() => game.parseLevel(first)).not.toThrow();
  });

  it("좌우 및 상하 대칭 맵을 같은 레벨로 정규화한다", () => {
    const original = ["######", "# @$.#", "#    #", "######"];
    const horizontal = original.map((row) => [...row].reverse().join(""));
    const vertical = [...original].reverse();
    expect(generator.canonicalizeLevel(horizontal)).toBe(
      generator.canonicalizeLevel(original),
    );
    expect(generator.canonicalizeLevel(vertical)).toBe(
      generator.canonicalizeLevel(original),
    );
  });

  it("채택한 레벨은 Solver 해답으로 실제 클리어된다", () => {
    const generated = generator.generateLevels(options);
    expect(generated.levels).toHaveLength(1);
    const accepted = generated.levels[0];
    const validation = generator.validateCandidate(accepted.map, options);
    expect(validation.accepted).toBe(true);

    let state = game.init(accepted.map);
    validation.solution.actions.forEach((direction) => {
      state = game.key(direction, state);
    });
    expect(state.isCleared).toBe(true);
    expect(validation.solution.pushes).toBeGreaterThanOrEqual(
      options.minPushes,
    );
    expect(validation.solution.moves).toBeGreaterThanOrEqual(options.minMoves);
  });

  it("잘못된 생성 옵션을 거부한다", () => {
    expect(() => generator.normalizeOptions({ rows: 4 })).toThrow("최소 5×5");
    expect(() => generator.normalizeOptions({ crates: 0 })).toThrow(
      "상자 수는 1~8",
    );
  });
});
