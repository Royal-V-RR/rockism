const test = require("node:test");
const assert = require("node:assert/strict");
const { loadGameFromIndexHtml } = require("../tools/load-game.cjs");

const { RockModel, Achievements, State, Compatibility, Relationships } = loadGameFromIndexHtml();

test("rock generation is deterministic for a given seed", () => {
  const a = RockModel.createNewRock("Gerald", "seed-alpha");
  const b = RockModel.createNewRock("Gerald", "seed-alpha");
  assert.deepEqual(a.appearance.silhouette, b.appearance.silhouette);
  assert.equal(a.appearance.classification, b.appearance.classification);
  assert.equal(a.stats.hardness, b.stats.hardness);
});

test("different seeds usually produce different appearances", () => {
  const a = RockModel.createNewRock("Gerald", "seed-alpha");
  const b = RockModel.createNewRock("Gerald", "seed-beta");
  assert.notDeepEqual(a.appearance.silhouette, b.appearance.silhouette);
});

test("save and load round trip preserves rock identity", () => {
  const rock = RockModel.createNewRock("Beryl", "seed-roundtrip");
  State.saveLive(rock);
  const loaded = State.loadLive();
  assert.equal(loaded.id, rock.id);
  assert.equal(loaded.seed, rock.seed);
  assert.deepEqual(loaded.appearance.silhouette, rock.appearance.silhouette);
});

test("export and import preserves appearance parameters", () => {
  const rock = RockModel.createNewRock("Flint", "seed-export");
  const payload = JSON.stringify({ schemaVersion: State.SCHEMA_VERSION, gameVersion: State.GAME_VERSION, rock });
  const imported = State.validateAndSanitizeImport(payload);
  assert.equal(imported.seed, rock.seed);
  assert.deepEqual(imported.appearance, rock.appearance);
  assert.equal(imported._wasImported, true);
});

test("malformed import is rejected without throwing an unhandled error", () => {
  assert.throws(() => State.validateAndSanitizeImport("{ not valid json"));
  assert.throws(() => State.validateAndSanitizeImport(JSON.stringify({ rock: {} })));
});

test("imported names are sanitized", () => {
  const rock = RockModel.createNewRock("Flint", "seed-sanitize");
  rock.name = "<script>bad</script>";
  const payload = JSON.stringify({ schemaVersion: State.SCHEMA_VERSION, gameVersion: State.GAME_VERSION, rock });
  const imported = State.validateAndSanitizeImport(payload);
  assert.ok(!imported.name.includes("<"));
});

test("achievement evaluation unlocks based on real conditions", () => {
  const rock = RockModel.createNewRock("Shale", "seed-achievements");
  rock.needs.polish = 100;
  const unlocked = Achievements.evaluate(rock);
  const ids = unlocked.map((u) => u.id);
  assert.ok(ids.includes("a003"));
  assert.ok(rock.unlockedAchievements.includes("a003"));
});

test("achievements do not unlock twice", () => {
  const rock = RockModel.createNewRock("Shale", "seed-repeat");
  rock.needs.polish = 100;
  Achievements.evaluate(rock);
  const second = Achievements.evaluate(rock);
  assert.ok(!second.map((u) => u.id).includes("a003"));
});

test("compatibility scoring is deterministic and identical rocks score highest", () => {
  const a = RockModel.createNewRock("Gerald", "seed-compat-a");
  const b = RockModel.createNewRock("Gerald", "seed-compat-a");
  const c = RockModel.createNewRock("Beryl", "seed-compat-c");
  const reportAB = Compatibility.computeCompatibility(a, b);
  const reportAB2 = Compatibility.computeCompatibility(a, b);
  assert.deepEqual(reportAB, reportAB2);
  // Identical structure and mineral composition score at their maximum.
  // Temperament deliberately does not reward total personality overlap as
  // perfect (it reads as stagnant), so a perfect physical twin still lands
  // high, not at 100.
  assert.equal(reportAB.structural, 100);
  assert.equal(reportAB.mineral, 100);
  assert.ok(reportAB.overall >= 85);
  const reportAC = Compatibility.computeCompatibility(a, c);
  assert.ok(reportAC.overall <= reportAB.overall);
});

test("relationship state machine advances through real stages", () => {
  const rock = RockModel.createNewRock("Gerald", "seed-rel-a");
  const companionRock = RockModel.createNewRock("Beryl", "seed-rel-b");
  const summary = State.toCompanionSummary(companionRock);
  Relationships.addCompanion(rock, summary);
  assert.equal(rock.relationships[summary.id].stage, "Stranger");

  Relationships.introduce(rock, summary.id);
  assert.equal(rock.relationships[summary.id].stage, "Acquainted");

  const report = Compatibility.computeCompatibility(rock, summary);
  for (let i = 0; i < 20 && rock.relationships[summary.id].stage !== "Committed"; i++) {
    Relationships.court(rock, summary.id, report.overall);
  }
  assert.equal(rock.relationships[summary.id].stage, "Committed");

  const household = Relationships.formHousehold(rock, summary.id);
  assert.equal(household.partnerId, summary.id);
  assert.equal(rock.relationships[summary.id].stage, "Cohabiting");
});

test("a household cannot be formed before commitment", () => {
  const rock = RockModel.createNewRock("Gerald", "seed-rel-early");
  const companionRock = RockModel.createNewRock("Beryl", "seed-rel-early-b");
  const summary = State.toCompanionSummary(companionRock);
  Relationships.addCompanion(rock, summary);
  Relationships.introduce(rock, summary.id);
  assert.throws(() => Relationships.formHousehold(rock, summary.id));
});

test("companion summaries never carry the companion's own save state", () => {
  const companionRock = RockModel.createNewRock("Beryl", "seed-summary");
  companionRock.currency = 999;
  const summary = State.toCompanionSummary(companionRock);
  assert.equal(summary.currency, undefined);
  assert.equal(summary.needs, undefined);
});

test("old-format saves missing newer fields are backfilled on load", () => {
  const rock = RockModel.createNewRock("Gerald", "seed-backfill");
  delete rock.companions;
  delete rock.relationships;
  delete rock.household;
  delete rock.furnitureInventory;
  delete rock.memories;
  delete rock.residence;
  global.localStorage.setItem(
    "rockism.save.v" + State.SCHEMA_VERSION,
    JSON.stringify({ schemaVersion: State.SCHEMA_VERSION, gameVersion: State.GAME_VERSION, rock })
  );
  const loaded = State.loadLive();
  assert.deepEqual(loaded.companions, []);
  assert.deepEqual(loaded.relationships, {});
  assert.equal(loaded.household, null);
  assert.deepEqual(loaded.furnitureInventory, []);
});

test("clothing and achievement catalogs have unique ids", () => {
  const { Clothing } = global.window.Rockism;
  const ids = Clothing.all().map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const achIds = Achievements.DEFS.map((a) => a.id);
  assert.equal(new Set(achIds).size, achIds.length);
});
