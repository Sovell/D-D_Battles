import { describe, expect, it } from "vitest";
import { createLegacyRoster } from "../progression/hero-progression";
import { assignHeroToParty, createCampaignState, createParty, deleteParty, equipItem, selectParty, transferStashItem } from "../equipment/campaign";

describe("persistent parties", () => {
  const roster = () => [...createLegacyRoster(), ...createLegacyRoster().slice(0, 3).map((hero, index) => ({ ...hero, id: `reserve-${index}`, name: `Reserve ${index}` }))];
  it("moves a hero without moving loadout or old party stash", () => {
    const heroes = roster();
    let campaign = createCampaignState(heroes);
    campaign = createParty(campaign, "Second", heroes.slice(4).map((hero) => hero.id), "2026-01-01T00:00:00.000Z");
    campaign = selectParty(campaign, "party-1");
    campaign = equipItem(campaign, heroes[0].id, "longsword");
    const oldStash = structuredClone(campaign.parties[0].stash);
    campaign = assignHeroToParty(campaign, heroes[0].id, campaign.parties[1].id);
    expect(campaign.parties[1].memberIds).toContain(heroes[0].id);
    expect(campaign.loadouts[heroes[0].id].weapon).toBe("longsword");
    expect(campaign.parties[0].stash).toEqual(oldStash);
  });
  it("does not delete a party with a non-empty stash", () => {
    const campaign = createCampaignState(roster());
    expect(deleteParty(campaign, campaign.selectedPartyId)).toBe(campaign);
  });
  it("transfers exactly one stash item and never duplicates it", () => {
    const heroes = roster();
    let campaign = createCampaignState(heroes);
    campaign = createParty(campaign, "Second", heroes.slice(4).map((hero) => hero.id));
    const [first, second] = campaign.parties;
    const totalBefore = first.stash.find((stack) => stack.definitionId === "potion-cure-light")!.quantity;
    campaign = transferStashItem(campaign, first.id, second.id, "potion-cure-light");
    const totalAfter = campaign.parties.reduce((sum, party) => sum + (party.stash.find((stack) => stack.definitionId === "potion-cure-light")?.quantity ?? 0), 0);
    expect(totalAfter).toBe(totalBefore);
    expect(campaign.parties[1].stash.find((stack) => stack.definitionId === "potion-cure-light")?.quantity).toBe(1);
  });
});
