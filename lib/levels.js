const LEVELS = [
  {
    id: 1,
    name: "첫걸음",
    difficulty: "easy",
    minimumPushes: 1,
    minimumMoves: 1,
    map: [
      "##########",
      "#        #",
      "#        #",
      "#   .    #",
      "#   $    #",
      "#   @    #",
      "#        #",
      "##########",
    ],
  },
  {
    id: 2,
    name: "길게 밀기",
    difficulty: "normal",
    minimumPushes: 3,
    minimumMoves: 4,
    map: [
      "##########",
      "#        #",
      "#        #",
      "# .  $ @ #",
      "#        #",
      "#        #",
      "#        #",
      "##########",
    ],
  },
  {
    id: 3,
    name: "방향 전환",
    difficulty: "normal",
    minimumPushes: 4,
    minimumMoves: 7,
    map: [
      "##########",
      "#        #",
      "# .      #",
      "#        #",
      "#   $    #",
      "#  @     #",
      "#        #",
      "##########",
    ],
  },
  {
    id: 4,
    name: "두 개의 상자",
    difficulty: "normal",
    minimumPushes: 4,
    minimumMoves: 14,
    map: [
      "############",
      "#          #",
      "#  .    .  #",
      "#          #",
      "#  $    $  #",
      "#          #",
      "#    @     #",
      "#          #",
      "#          #",
      "############",
    ],
  },
  {
    id: 5,
    name: "상자 배정",
    difficulty: "hard",
    minimumPushes: 10,
    minimumMoves: 22,
    map: [
      "############",
      "#          #",
      "# .      . #",
      "#          #",
      "#          #",
      "#   $  $   #",
      "#          #",
      "#    @     #",
      "#          #",
      "############",
    ],
  },
  {
    id: 6,
    name: "갈라진 통로",
    difficulty: "hard",
    minimumPushes: 10,
    minimumMoves: 24,
    map: [
      "############",
      "#          #",
      "# .      . #",
      "#          #",
      "#   ####   #",
      "#          #",
      "#  $    $  #",
      "#    @     #",
      "#          #",
      "############",
    ],
  },
  {
    id: 7,
    name: "세 갈래",
    difficulty: "hard",
    minimumPushes: 12,
    minimumMoves: 32,
    map: [
      "##############",
      "#            #",
      "#  .   .  .  #",
      "#            #",
      "#            #",
      "#            #",
      "#  $   $  $  #",
      "#            #",
      "#     @      #",
      "#            #",
      "#            #",
      "##############",
    ],
  },
  {
    id: 8,
    name: "나뉜 벽",
    difficulty: "expert",
    minimumPushes: 18,
    minimumMoves: 40,
    map: [
      "##############",
      "#            #",
      "# .        . #",
      "#            #",
      "#      .     #",
      "#            #",
      "#    ## ##   #",
      "#            #",
      "#  $   $  $  #",
      "#     @      #",
      "#            #",
      "##############",
    ],
  },
  {
    id: 9,
    name: "세 개의 기둥",
    difficulty: "expert",
    minimumPushes: 21,
    minimumMoves: 50,
    map: [
      "################",
      "#              #",
      "#  .    .   .  #",
      "#              #",
      "#              #",
      "#              #",
      "#              #",
      "#              #",
      "#              #",
      "#  $    $   $  #",
      "#              #",
      "#      @       #",
      "#              #",
      "################",
    ],
  },
  {
    id: 10,
    name: "최종 창고",
    difficulty: "expert",
    minimumPushes: 26,
    minimumMoves: 58,
    map: [
      "################",
      "#              #",
      "# .     .    . #",
      "#              #",
      "#              #",
      "#              #",
      "#   ###   ##   #",
      "#              #",
      "#              #",
      "#              #",
      "#  $    $   $  #",
      "#              #",
      "#      @       #",
      "################",
    ],
  },
];

const SIZE_TIERS = [
  { rows: 8, columns: 10, levels: 3 },
  { rows: 10, columns: 12, levels: 3 },
  { rows: 12, columns: 14, levels: 2 },
  { rows: 14, columns: 16, levels: 2 },
];

const getLevelCount = () => LEVELS.length;

const getExpectedSize = (levelNumber) => {
  if (!Number.isInteger(levelNumber) || levelNumber < 1) {
    throw new RangeError("레벨 번호는 1 이상의 정수여야 합니다.");
  }
  let remaining = levelNumber;
  for (const tier of SIZE_TIERS) {
    if (remaining <= tier.levels) {
      return { rows: tier.rows, columns: tier.columns };
    }
    remaining -= tier.levels;
  }
  throw new RangeError(`레벨 ${levelNumber}의 크기 티어가 없습니다.`);
};

const getLevel = (levelNumber) => {
  if (
    !Number.isInteger(levelNumber) ||
    levelNumber < 1 ||
    levelNumber > LEVELS.length
  ) {
    throw new RangeError(`레벨은 1~${LEVELS.length} 사이여야 합니다.`);
  }
  return structuredClone(LEVELS[levelNumber - 1]);
};

module.exports = {
  LEVELS,
  SIZE_TIERS,
  getLevel,
  getLevelCount,
  getExpectedSize,
};
