const { inspect, styleText } = require("node:util");
const game = require("../lib/index.js");

// styleText 는 모르는 색 이름에 예외를 던지므로 없는 색은 기호만 그린다
const colorCell = (color, symbol) =>
  Object.hasOwn(inspect.colors, color) ? styleText(color, symbol) : symbol;

const SYMBOLS = {
  grey: "  ",
  [game.COLORS.wall]: colorCell(game.COLORS.wall, "██"),
  [game.COLORS.target]: colorCell(game.COLORS.target, "··"),
  [game.COLORS.crate]: colorCell(game.COLORS.crate, "▣ "),
  [game.COLORS.crateOnTarget]: colorCell(game.COLORS.crateOnTarget, "▣ "),
  [game.COLORS.player]: colorCell(game.COLORS.player, "● "),
};

const format = (panel) =>
  panel
    .map((row) => row.map((cell) => SYMBOLS[cell.color] ?? "? ").join(""))
    .join("\r\n");

module.exports = { format };
