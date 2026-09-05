import { describe, expect, it } from "vitest";
import { createCampaignState, selectParty } from "../equipment/campaign";
import { createLegacyRoster } from "../progression/hero-progression";
import { claimReward } from "../equipment/rewards";
import { fracturedSealCampaign } from "./campaign-presets";
import { getAvailableNodes, getNodeStatus, recordCampaignVictory, saveCampaignDefinition, startCampaignRun, validateCampaignDefinition } from "./campaign-wings";
import { launchCampaignNode, previewCampaignNode } from "./campaign-launch";
import { settleBattleResult } from "./battle-results";
import { migrateCampaignV1ToV2, parseCampaignState } from "../../app/session-storage";

function setup() { return startCampaignRun(saveCampaignDefinition(createCampaignState(createLegacyRoster()), fracturedSealCampaign()), "fractured-seal", "party-1", "test-run"); }
function win(state: ReturnType<typeof setup>, node: string, id: string) {
  const launched = launchCampaignNode(state, "test-run", node, id);
  const result = settleBattleResult(launched.campaign, { ...launched.battle, outcome: "victory" });
  return claimReward(result, result.pendingReward!.choices[0]);
}
describe("campaign wings", () => {
  it("migrates v1 without losing party ownership, inventory, money or history", () => {
    const state = createCampaignState(createLegacyRoster());
    state.parties[0].gold = 123; state.parties[0].materials = 17;
    const legacy = { ...state, version: 1, campaignDefinitions: undefined, campaignRuns: undefined };
    const migrated = migrateCampaignV1ToV2(legacy);
    expect(migrated).toMatchObject({ version: 2, campaignDefinitions: [], campaignRuns: [], parties: state.parties, heroes: state.heroes, loadouts: state.loadouts });
    expect(parseCampaignState(JSON.stringify(legacy))).toEqual(state);
  });
  it("rejects cycles, duplicate nodes, absent snapshots and unknown milestone items atomically", () => {
    const base = fracturedSealCampaign(); expect(validateCampaignDefinition(base)).toEqual([]);
    const cycle = structuredClone(base); cycle.nodes[0].prerequisites.completedNodeIds = [cycle.nodes[1].id]; cycle.nodes[1].prerequisites.completedNodeIds = [cycle.nodes[0].id];
    const duplicate = structuredClone(base); duplicate.nodes[1].id = duplicate.nodes[0].id;
    const missing = structuredClone(base); delete (missing.nodes[0] as Partial<typeof missing.nodes[0]>).scenarioSnapshot;
    const item = structuredClone(base); item.nodes[0].milestoneReward = { guaranteedItemIds: ["nonexistent"] };
    for (const value of [cycle, duplicate, missing, item]) expect(validateCampaignDefinition(value).length).toBeGreaterThan(0);
    const state = setup(); expect(parseCampaignState(JSON.stringify({ ...state, campaignDefinitions: [base, cycle] }))).toBeNull();
    const corrupted = structuredClone(state); corrupted.campaignRuns[0].flags = ["forged-key"];
    expect(parseCampaignState(JSON.stringify(corrupted))).toBeNull();
    expect(parseCampaignState(JSON.stringify(state))).toEqual(state);
  });
  it("freezes both source scenario and definition and prohibits duplicate active runs", () => {
    const state = setup(); const original = structuredClone(state.campaignRuns[0]);
    state.campaignDefinitions[0].nodes[0].scenarioSnapshot.name = "Changed source";
    expect(state.campaignRuns[0]).toEqual(original);
    expect(() => startCampaignRun(state, "fractured-seal", "party-1", "second")).toThrow();
    state.campaignDefinitions = [];
    expect(previewCampaignNode(state, "test-run", "outer-gate").scenario.name).toBe("Najeźdźcy z przedmurza");
  });
  it("allows wings in either order, unlocks the boss, and keeps completed runs as history", () => {
    for (const order of [["bones", "outer-gate"], ["outer-gate", "bones"]]) {
      let state = setup(); expect(getAvailableNodes(state.campaignRuns[0])).toHaveLength(2);
      state = win(state, order[0], "one"); expect(getNodeStatus(state.campaignRuns[0], "broken-seal").status).toBe("locked");
      state = win(state, order[1], "two"); expect(getNodeStatus(state.campaignRuns[0], "broken-seal").status).toBe("available");
      state = win(state, "broken-seal", "three"); expect(state.campaignRuns[0].status).toBe("completed");
      const rerun = startCampaignRun(state, "fractured-seal", "party-1", "next-run"); expect(rerun.campaignRuns).toHaveLength(2); expect(rerun.campaignRuns[0]).toEqual(state.campaignRuns[0]);
    }
  });
  it("settles XP, history, flags, loot and milestone once even when replaying a saved victory", () => {
    const state = setup(); state.campaignRuns[0].campaignSnapshot.nodes[0].milestoneReward = { gold: 12, materials: 3, guaranteedItemIds: ["cloak-resistance-2"] };
    const launched = launchCampaignNode(state, "test-run", "outer-gate", "receipt");
    const battle = { ...launched.battle, outcome: "victory" as const };
    const result = settleBattleResult(launched.campaign, battle);
    expect(result.parties[0]).toMatchObject({ gold: 12 + battle.scenario.rewardBundle!.gold, materials: 3 + battle.scenario.rewardBundle!.materials, expeditionHistory: [expect.objectContaining({ id: "receipt" })] });
    expect(result.heroes[0].xp).toBe(battle.scenario.rewardBundle!.xp);
    expect(result.campaignRuns[0].flags).toEqual(["outer-gate-key"]);
    expect(result.parties[0].stash).toContainEqual({ definitionId: "cloak-resistance-2", quantity: 1 });
    const claimed = claimReward(result, result.pendingReward!.choices[0]);
    expect(claimed.parties[0].gold).toBe(result.parties[0].gold);
    expect(claimed.parties[0].materials).toBe(result.parties[0].materials);
    expect(parseCampaignState(JSON.stringify(result))).toEqual(result);
    expect(settleBattleResult(claimed, battle)).toBe(claimed);
    expect(recordCampaignVictory(claimed, battle.scenario.campaignContext!)).toBe(claimed);
  });
  it("records defeat once, consumes potions, leaves flags empty and permits retry", () => {
    const state = setup(); state.loadouts.fighter.consumables[0] = "potion-cure-light";
    const launched = launchCampaignNode(state, "test-run", "bones", "defeat");
    const battle = { ...launched.battle, outcome: "defeat" as const, spentItemCharges: { fighter: { "potion-cure-light": 1 } } };
    const failed = settleBattleResult(launched.campaign, battle);
    expect(failed.campaignRuns[0]).toMatchObject({ attemptsByNodeId: { bones: 1 }, flags: [], completedNodeIds: [], claimedMilestoneNodeIds: [] });
    expect(failed.heroes).toEqual(state.heroes); expect(failed.loadouts.fighter.consumables[0]).toBeNull();
    expect(settleBattleResult(failed, battle)).toBe(failed);
    expect(launchCampaignNode(failed, "test-run", "bones", "retry").battle.scenario.campaignContext?.battleId).toBe("retry");
  });
  it("rejects another party's launch and completion", () => {
    const state = setup(); state.parties.push({ ...structuredClone(state.parties[0]), id: "other", memberIds: [] });
    expect(() => launchCampaignNode(selectParty(state, "other"), "test-run", "bones")).toThrow();
    const launched = launchCampaignNode(state, "test-run", "bones", "owner");
    const foreign = selectParty(launched.campaign, "other");
    expect(settleBattleResult(foreign, { ...launched.battle, outcome: "victory" })).toBe(foreign);
    const forged = structuredClone(launched.battle); forged.scenario.campaignContext!.partyId = "other";
    expect(settleBattleResult(launched.campaign, { ...forged, outcome: "victory" })).toBe(launched.campaign);
  });
  it("recomputes rewards and difficulty at launch from current heroes and equipment", () => {
    const state = setup(); const before = previewCampaignNode(state, "test-run", "bones");
    state.heroes = state.heroes.map((h) => ({ ...h, level: 5, xp: 700 })); state.loadouts.fighter.armor = "plate-mail";
    const after = launchCampaignNode(state, "test-run", "bones", "leveled").battle;
    expect(after.scenario.partyPower).toBeGreaterThan(before.scenario.partyPower!);
    expect(after.scenario.rewardBundle?.level).toBe(5);
    expect(after.scenario.rewardBundle).toEqual(previewCampaignNode(state, "test-run", "bones").reward);
  });
  it("ordinary standalone scenarios never mutate campaign progress", () => {
    const state = setup(); const launched = launchCampaignNode(state, "test-run", "bones", "ordinary");
    const battle = { ...launched.battle, outcome: "victory" as const, scenario: { ...launched.battle.scenario, campaignContext: undefined } };
    expect(settleBattleResult(state, battle).campaignRuns).toEqual(state.campaignRuns);
  });
  it("preserves guaranteed overflow and claims standard loot only once after reload", () => {
    const state = setup();
    state.parties[0].stash.push({ definitionId: "cloak-resistance-2", quantity: 20 });
    state.campaignRuns[0].campaignSnapshot.nodes[0].milestoneReward = { guaranteedItemIds: ["cloak-resistance-2"] };
    const launched = launchCampaignNode(state, "test-run", "outer-gate", "full-stash");
    const result = settleBattleResult(launched.campaign, { ...launched.battle, outcome: "victory" });
    expect(result.parties[0].stash).toContainEqual({ definitionId: "cloak-resistance-2", quantity: 21 });
    const item = result.pendingReward!.choices[0];
    result.parties[0].stash = [...result.parties[0].stash.filter((s) => s.definitionId !== item), { definitionId: item, quantity: 20 }];
    const restored = parseCampaignState(JSON.stringify(result))!;
    expect(restored).not.toBeNull();
    const claimed = claimReward(restored, item);
    expect(claimed.pendingReward).toBeUndefined();
    expect(claimed.parties[0].stash).toContainEqual({ definitionId: item, quantity: 21 });
    expect(claimed.parties[0].gold).toBe(restored.parties[0].gold);
    expect(parseCampaignState(JSON.stringify(claimed))).toEqual(claimed);
    expect(claimReward(claimed, item)).toBe(claimed);
  });
  it("restores an unfinished attempt and blocks overlapping launches", () => {
    const launched = launchCampaignNode(setup(), "test-run", "bones", "unfinished");
    const restored = parseCampaignState(JSON.stringify(launched.campaign))!;
    expect(restored.campaignRuns[0].pendingBattle).toEqual(launched.campaign.campaignRuns[0].pendingBattle);
    expect(() => launchCampaignNode(restored, "test-run", "outer-gate")).toThrow();
    const settled = settleBattleResult(restored, { ...launched.battle, outcome: "victory" });
    expect(settled.campaignRuns[0].completedNodeIds).toEqual(["bones"]);
  });
});
