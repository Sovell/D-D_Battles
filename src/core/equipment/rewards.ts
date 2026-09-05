import type { CampaignState, DifficultyLabel, HeroProfile, ItemDefinition, ItemRarity, RewardBundle, ScenarioTemplateId } from "../domain/types";
import { createRandom } from "../random/random";
import { addItem } from "./campaign";
import { itemById, items } from "./items";
import { heroClassById } from "../data/heroes";

const rarityRank: Record<ItemRarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4 };

const rewardScale: Record<DifficultyLabel, { xp: number; gold: number; materials: number; count: 2 | 3; maxRank: number }> = {
  Trivial: { xp: 15, gold: 8, materials: 1, count: 2, maxRank: 1 },
  Easy: { xp: 55, gold: 20, materials: 2, count: 2, maxRank: 2 },
  Standard: { xp: 100, gold: 40, materials: 4, count: 3, maxRank: 2 },
  Hard: { xp: 145, gold: 65, materials: 6, count: 3, maxRank: 3 },
  Deadly: { xp: 200, gold: 90, materials: 9, count: 3, maxRank: 3 },
  Overwhelming: { xp: 220, gold: 105, materials: 10, count: 3, maxRank: 4 },
};

export function createRewardBundle(seed: number, scenarioId: string, templateId: ScenarioTemplateId | undefined, partyLevel: number, bossCache = false, difficulty: DifficultyLabel = "Standard", partyId?: string, heroes: readonly HeroProfile[] = [], preferredTags: readonly string[] = []): RewardBundle {
  const level = Math.max(1, Math.min(5, Math.floor(partyLevel)));
  const random = createRandom(seed ^ hash(scenarioId));
  const scale = rewardScale[difficulty];
  const levelRank = level >= 5 ? 4 : level >= 3 ? 3 : level >= 2 ? 2 : 1;
  const maxRank = Math.min(levelRank, scale.maxRank);
  let pool = items.filter((entry) => entry.rewardEligible !== false && entry.levelMin <= level && rarityRank[entry.rarity] <= maxRank);
  if (templateId === "rescue" || templateId === "treasure-run") pool = pool.filter((entry) => entry.tags.includes("utility") || entry.tags.includes("defense"));
  const classTags = new Set([...preferredTags, ...heroes.flatMap((hero) => heroClassById.get(hero.classId)?.equipmentTags ?? (hero.classId === "wizard" ? ["arcane"] : hero.classId === "cleric" ? ["divine", "healing"] : hero.classId === "rogue" ? ["utility", "stealth"] : ["weapon", "defense"]))]);
  pool.sort((a, b) => Number(b.tags.some((tag) => classTags.has(tag))) - Number(a.tags.some((tag) => classTags.has(tag))));
  const preferred = pool.filter((entry) => entry.tags.some((tag) => classTags.has(tag)));
  const choices = pickDistinct(preferred.length >= scale.count ? preferred : pool, scale.count, random);
  if (bossCache || difficulty === "Deadly") {
    const guaranteed = items.filter((entry) => entry.rewardEligible !== false && entry.levelMin <= level && (entry.rarity === "rare" || entry.rarity === "epic"));
    if (guaranteed.length) choices[0] = guaranteed[random.int(0, guaranteed.length - 1)].id;
  }
  return { id: `reward-${scenarioId}-${seed}`, scenarioId, partyId, choices: [...new Set(choices)], level, bossCache, difficulty, xp: scale.xp, gold: scale.gold, materials: scale.materials };
}

export function claimReward(campaign: CampaignState, definitionId: string): CampaignState {
  if (!campaign.pendingReward?.choices.includes(definitionId) || !itemById.has(definitionId)) return campaign;
  const partyId = campaign.pendingReward.partyId ?? campaign.selectedPartyId;
  const target = campaign.parties.find((party) => party.id === partyId);
  if (!target) return campaign;
  const inventory = addItem(target.stash, definitionId);
  const before = target.stash.find((stack) => stack.definitionId === definitionId)?.quantity ?? 0;
  const after = inventory.find((stack) => stack.definitionId === definitionId)?.quantity ?? 0;
  if (after <= before) {
    if (!campaign.pendingReward.currencyGranted) return campaign;
    // Campaign loot must remain claimable even when every offered stack is full.
    inventory.find((stack) => stack.definitionId === definitionId)!.quantity = before + 1;
  }
  const reward = campaign.pendingReward;
  const parties = campaign.parties.map((party) => party.id === partyId ? { ...party, stash: inventory, gold: party.gold + (reward.currencyGranted ? 0 : reward.gold), materials: party.materials + (reward.currencyGranted ? 0 : reward.materials) } : party);
  return { ...campaign, parties, inventory: campaign.selectedPartyId === partyId ? inventory : campaign.inventory, pendingReward: undefined };
}

function pickDistinct(pool: ItemDefinition[], count: number, random: ReturnType<typeof createRandom>): string[] {
  const remaining = [...pool]; const result: string[] = [];
  while (remaining.length && result.length < count) result.push(remaining.splice(random.int(0, remaining.length - 1), 1)[0].id);
  return result;
}
function hash(value: string): number { let result = 2166136261; for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619); return result >>> 0; }
