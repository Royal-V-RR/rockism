// Validates the game's data catalogs. Loads the real game logic straight
// out of the single-file index.html (see tools/load-game.cjs) so this
// never checks a stale duplicate of the data.
const { loadGameFromIndexHtml } = require("./load-game.cjs");
const { Clothing, Furniture, Achievements, RockModel, Compatibility } = loadGameFromIndexHtml();

let failed = false;

function check(label, condition) {
  const status = condition ? "OK" : "FAIL";
  if (!condition) failed = true;
  console.log("[" + status + "] " + label);
}

const clothingIds = Clothing.all().map((c) => c.id);
const uniqueClothingIds = new Set(clothingIds);
check("Clothing catalog has no duplicate ids", uniqueClothingIds.size === clothingIds.length);
check("Clothing catalog is non-empty", clothingIds.length > 0);

const achievementIds = Achievements.DEFS.map((a) => a.id);
const uniqueAchievementIds = new Set(achievementIds);
check("Achievement catalog has no duplicate ids", uniqueAchievementIds.size === achievementIds.length);
check("Achievement catalog is non-empty", achievementIds.length > 0);

check("Rock class list is non-empty", RockModel.CLASSES.length > 0);

const furnitureIds = Furniture.all().map((f) => f.id);
check("Furniture catalog has no duplicate ids", new Set(furnitureIds).size === furnitureIds.length);
check("Furniture catalog is non-empty", furnitureIds.length > 0);

const rockA = RockModel.createNewRock("Validator A", "validate-seed-a");
const rockB = RockModel.createNewRock("Validator A", "validate-seed-a");
const reportSelf = Compatibility.computeCompatibility(rockA, rockB);
check("Compatibility engine scores identical structure and mineral composition at maximum", reportSelf.structural === 100 && reportSelf.mineral === 100);

console.log("");
console.log("Clothing items defined: " + clothingIds.length + " of " + Clothing.TOTAL_PLANNED + " planned.");
console.log("Achievements defined: " + achievementIds.length + " of " + Achievements.TOTAL_PLANNED + " planned.");
if (clothingIds.length < Clothing.TOTAL_PLANNED || achievementIds.length < Achievements.TOTAL_PLANNED) {
  console.log("NOTE: catalogs are below their specified full size. This build is a partial");
  console.log("content pass; structural validation still passes so CI can run on every");
  console.log("commit while content is filled in incrementally.");
}

if (failed) {
  console.error("\nData validation failed.");
  process.exit(1);
} else {
  console.log("\nData validation passed.");
}
