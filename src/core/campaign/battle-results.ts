import type { BattleState, CampaignState } from "../domain/types";
import { awardVictoryXp } from "../progression/hero-progression";
import { reconcileBattleItems } from "../equipment/campaign";
import { assessDifficulty } from "./difficulty";
import { recordCampaignDefeat, recordCampaignVictory, validCampaignContext } from "./campaign-wings";

/** One campaign-state transaction: existing XP/items/history plus optional wing progress. */
export function settleBattleResult(current: CampaignState, battle: BattleState, now = new Date().toISOString()): CampaignState {
  if (battle.outcome === "active") return current;
  const context = battle.scenario.campaignContext;
  const run = context ? validCampaignContext(current, context) : undefined;
  if (context && !run) return current;
  const participatingIds = (battle.heroSnapshots ?? []).map((h) => h.id);
  if (run && (participatingIds.length !== run.pendingBattle!.participantIds.length || participatingIds.some((id) => !run.pendingBattle!.participantIds.includes(id)))) return current;
  const partyId = context?.partyId ?? battle.scenario.rewardBundle?.partyId ?? current.selectedPartyId;
  const receipt = context?.battleId ?? `expedition-${battle.scenario.id}-${battle.seed}-${now}`;
  if (current.parties.some((p) => p.expeditionHistory.some((entry) => entry.id === receipt))) return current;
  const reconciled = reconcileBattleItems(current, battle.spentItemCharges, battle.heroLoadoutSnapshots);
  const persistent = battle.scenario.persistentRewards === true;
  const reward = battle.scenario.rewardBundle;
  const victory = battle.outcome === "victory";
  const grantCurrency = Boolean(context && victory && persistent && reward);
  const assessment = assessDifficulty(battle.heroSnapshots ?? [], battle.heroLoadoutSnapshots ?? {}, battle.scenario.encounter.monsters, battle.scenario.templateId);
  const historyEntry = { id: receipt, scenarioId: battle.scenario.id, scenarioName: battle.scenario.name, completedAt: now, outcome: battle.outcome, participantIds: participatingIds, difficulty: reward?.difficulty ?? assessment.label, difficultyRatio: battle.scenario.difficultyRatio ?? assessment.ratio, reward: victory && persistent ? reward : undefined };
  const next = { ...reconciled, heroes: victory && persistent ? awardVictoryXp(reconciled.heroes, participatingIds, reward?.xp ?? battle.scenario.rewardXp) : reconciled.heroes, parties: reconciled.parties.map((p) => p.id === partyId ? { ...p, gold: p.gold + (grantCurrency ? reward!.gold : 0), materials: p.materials + (grantCurrency ? reward!.materials : 0), expeditionHistory: [...p.expeditionHistory, historyEntry] } : p), pendingReward: victory && persistent ? reward && { ...reward, ...(grantCurrency ? { currencyGranted: true } : {}) } : reconciled.pendingReward };
  return context ? victory ? recordCampaignVictory(next, context, now) : recordCampaignDefeat(next, context, now) : next;
}
