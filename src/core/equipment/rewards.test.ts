import { describe, expect, it } from "vitest";
import { itemById } from "./items";
import { createRewardBundle } from "./rewards";
import { claimReward } from "./rewards";
import { createCampaignState } from "./campaign";

describe("campaign rewards", () => {
  it("creates a deterministic choice of three level-appropriate rewards", () => {
    const first = createRewardBundle(444, "crypt", "skirmish", 2);
    expect(createRewardBundle(444, "crypt", "skirmish", 2)).toEqual(first);
    expect(first.choices).toHaveLength(3);
    expect(first.choices.every((id) => itemById.get(id)!.levelMin <= 2 && ["common", "uncommon"].includes(itemById.get(id)!.rarity))).toBe(true);
  });

  it("prefers utility or defense for Rescue and Treasure Run", () => {
    for (const template of ["rescue", "treasure-run"] as const) expect(createRewardBundle(77, template, template, 5).choices.every((id) => itemById.get(id)!.tags.some((tag) => tag === "utility" || tag === "defense"))).toBe(true);
  });

  it("guarantees Rare or Epic in a level-appropriate boss cache", () => {
    const reward = createRewardBundle(88, "dragon", "skirmish", 5, true);
    expect(["rare", "epic"]).toContain(itemById.get(reward.choices[0])!.rarity);
    expect(createRewardBundle(88, "low-boss", "skirmish", 1, true).choices.every((id) => itemById.get(id)!.rarity === "common")).toBe(true);
  });

  it("adds only a selected pending reward to shared inventory", () => {
    const bundle = createRewardBundle(9, "rescue", "rescue", 2);
    const campaign = { ...createCampaignState([]), pendingReward: bundle };
    const claimed = claimReward(campaign, bundle.choices[0]);
    expect(claimed.pendingReward).toBeUndefined();
    expect(claimed.inventory.some((stack) => stack.definitionId === bundle.choices[0])).toBe(true);
    expect(claimReward(campaign, "scroll-fireball")).toBe(campaign);
  });

  it("makes Trivial rewards deliberately weak and scales guaranteed progress", () => {
    const trivial = createRewardBundle(31, "farm", "skirmish", 5, false, "Trivial");
    const deadly = createRewardBundle(31, "danger", "skirmish", 5, false, "Deadly");
    expect(trivial.xp).toBeLessThan(deadly.xp);
    expect(trivial.gold).toBeLessThan(deadly.gold);
    expect(trivial.choices).toHaveLength(2);
    expect(trivial.choices.every((id) => itemById.get(id)?.rarity === "common")).toBe(true);
    expect(["rare", "epic"]).toContain(itemById.get(deadly.choices[0])?.rarity);
  });
});
