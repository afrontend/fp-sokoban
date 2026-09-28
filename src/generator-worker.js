const { parentPort, workerData } = require("node:worker_threads");
const generator = require("../lib/generator.js");

const options = generator.normalizeOptions(workerData.options);

parentPort.on("message", ({ attempt }) => {
  try {
    const random = generator.createRandom(`${options.seed}:${attempt}`);
    const map = generator.generateCandidate(options, random);
    if (!map) {
      parentPort.postMessage({
        attempt,
        result: { accepted: false, reason: "invalid" },
      });
      return;
    }
    const validation = generator.validateCandidate(map, options);
    parentPort.postMessage({ attempt, map, result: validation });
  } catch (error) {
    parentPort.postMessage({
      attempt,
      result: { accepted: false, reason: "invalid", error: error.message },
    });
  }
});
