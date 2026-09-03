import type { CampaignState, ItemDefinition, ItemRarity, RewardBundle, ScenarioTemplateId } from "../domain/types";
import { createRandom } from "../random/random";
import { addItem } from "./campaign";
import { itemById, items } from "./items";

const rarityRank: Record<ItemRarity, number> = { common: 1, uncommon: 2, rare: 3, epic: 4 };

export function createRewardBundle(seed: number, scenarioId: string, templateId: ScenarioTemplateId | undefined, partyLevel: number, bossCache = false): RewardBundle {
  const level = Math.max(1, Math.min(5, Math.floor(partyLevel)));
  const random = createRandom(seed ^ hash(scenarioId));
  const maxRank = level >= 5 ? 4 : level >= 3 ? 3 : level >= 2 ? 2 : 1;
  let pool = items.filter((entry) => entry.levelMin <= level && rarityRank[entry.rarity] <= maxRank);
  if (templateId === "rescue" || templateId === "treasure-run") pool = pool.filter((entry) => entry.tags.includes("utility") || entry.tags.includes("defense"));
  const choices = pickDistinct(pool, 3, random);
  if (bossCache) {
    const guaranteed = items.filter((entry) => entry.levelMin <= level && (entry.rarity === "rare" || entry.rarity === "epic"));
    if (guaranteed.length) choices[0] = guaranteed[random.int(0, guaranteed.length - 1)].id;
  }
  return { id: `reward-${scenarioId}-${seed}`, scenarioId, choices, level, bossCache };
}

export function claimReward(campaign: CampaignState, definitionId: string): CampaignState {
  if (!campaign.pendingReward?.choices.includes(definitionId) || !itemById.has(definitionId)) return campaign;
  const inventory = addItem(campaign.inventory, definitionId);
  const before = campaign.inventory.find((stack) => stack.definitionId === definitionId)?.quantity ?? 0;
  const after = inventory.find((stack) => stack.definitionId === definitionId)?.quantity ?? 0;
  return after > before ? { ...campaign, inventory, pendingReward: undefined } : campaign;
}

function pickDistinct(pool: ItemDefinition[], count: number, random: ReturnType<typeof createRandom>): string[] {
  const remaining = [...pool]; const result: string[] = [];
  while (remaining.length && result.length < count) result.push(remaining.splice(random.int(0, remaining.length - 1), 1)[0].id);
  return result;
}
function hash(value: string): number { let result = 2166136261; for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619); return result >>> 0; }
