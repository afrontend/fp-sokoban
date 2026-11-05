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
    name: "좁은 통로",
    difficulty: "normal",
    minimumPushes: 16,
    minimumMoves: 50,
    map: [
      "##########",
      "## . . ###",
      "# # #    #",
      "#  #@$   #",
      "##   ## ##",
      "#    $  ##",
      "# ##    ##",
      "##########",
    ],
  },
  {
    id: 3,
    name: "막힌 모퉁이",
    difficulty: "normal",
    minimumPushes: 14,
    minimumMoves: 49,
    map: [
      "##########",
      "#   ### ##",
      "##+##    #",
      "# $   #$ #",
      "#   #    #",
      "###      #",
      "#.   ## ##",
      "##########",
    ],
  },
  {
    id: 4,
    name: "세 개의 상자",
    difficulty: "normal",
    minimumPushes: 17,
    minimumMoves: 73,
    map: [
      "############",
      "###       ##",
      "#  #$ #  # #",
      "#  #  #    #",
      "##  $ #    #",
      "# #   # #  #",
      "#  .# #   ##",
      "# #  $  .###",
      "# # #@#. ###",
      "############",
    ],
  },
  {
    id: 5,
    name: "갈림길",
    difficulty: "hard",
    minimumPushes: 22,
    minimumMoves: 79,
    map: [
      "############",
      "##@#   #  ##",
      "# $#.      #",
      "#  # $ #  ##",
      "#  ##. # . #",
      "#     #  # #",
      "# $ #  ### #",
      "# #    # ###",
      "####       #",
      "############",
    ],
  },
  {
    id: 6,
    name: "긴 복도",
    difficulty: "hard",
    minimumPushes: 25,
    minimumMoves: 63,
    map: [
      "############",
      "##      #  #",
      "######  # .#",
      "#.     ### #",
      "# #   ###  #",
      "#  #$@#    #",
      "###  $     #",
      "## $  ##  .#",
      "#       ## #",
      "############",
    ],
  },
  {
    id: 7,
    name: "네 개의 상자",
    difficulty: "hard",
    minimumPushes: 25,
    minimumMoves: 84,
    map: [
      "##############",
      "# #        . #",
      "#  ##  $#  ###",
      "#   #   ####.#",
      "# #   ##     #",
      "# ##    .    #",
      "##@$  ##$.# ##",
      "### #     #  #",
      "#   $  #   # #",
      "# ##         #",
      "# ####  # ## #",
      "##############",
    ],
  },
  {
    id: 8,
    name: "미로 창고",
    difficulty: "expert",
    minimumPushes: 25,
    minimumMoves: 83,
    map: [
      "##############",
      "#        #  ##",
      "### #    #   #",
      "##  ##.  # ###",
      "#  #  # ##   #",
      "# ## .     # #",
      "## . #    ## #",
      "# # ## #   # #",
      "#   ##$@$   ##",
      "# # $ .## $  #",
      "##    #      #",
      "##############",
    ],
  },
  {
    id: 9,
    name: "큰 미로",
    difficulty: "expert",
    minimumPushes: 24,
    minimumMoves: 113,
    map: [
      "################",
      "###     #    # #",
      "#  ### ###.    #",
      "#.     ##  ##  #",
      "#.##$#    ###  #",
      "#  #  #  @$  $ #",
      "#   #  #. ###  #",
      "#   $      # # #",
      "#     #    # ###",
      "##  # #  #   ###",
      "# #       #    #",
      "#  . #$### # # #",
      "###         #  #",
      "################",
    ],
  },
  {
    id: 10,
    name: "최종 창고",
    difficulty: "expert",
    minimumPushes: 28,
    minimumMoves: 106,
    map: [
      "################",
      "#   ####       #",
      "##  $ # #  $   #",
      "#   #+$.    #  #",
      "#      #  #   ##",
      "#.## #####   ###",
      "## ## #        #",
      "##  #     #  # #",
      "#   ###  #     #",
      "###   #   ##  ##",
      "# #  ## #.  #$ #",
      "# ## ## $ .    #",
      "#        #   # #",
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
