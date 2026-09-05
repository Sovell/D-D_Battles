import type { CampaignState, HeroProfile, ScenarioDefinition } from "../domain/types";
import { getNodeStatus, type CampaignRun } from "./campaign-wings";
import { assessDifficulty } from "./difficulty";
import { createRewardBundle } from "../equipment/rewards";
import { createBattle } from "../scenario/create-battle";
import { buildScenarioTemplate, scenarioTemplateById } from "../scenario/scenario-templates";
import { encounterThemeById } from "../scenario/encounter-themes";
import { generateScenarioMap } from "../map-generation/scenario-map";

/** Shared by preview and launch, always reads the run's frozen scenario and current party. */
export function previewCampaignNode(state: CampaignState, runId: string, nodeId: string, seed?: number) {
  const run = state.campaignRuns.find((r) => r.id === runId);
  const node = run?.campaignSnapshot.nodes.find((n) => n.id === nodeId);
  const party = state.parties.find((p) => p.id === run?.partyId);
  if (!run || !node || !party) throw new Error("Nie znaleziono wyprawy, misji lub drużyny.");
  const heroes = party.memberIds.map((id) => state.heroes.find((h) => h.id === id)).filter((h): h is HeroProfile => Boolean(h));
  if (heroes.length < 3 || heroes.length > 4 || heroes.length !== party.memberIds.length) throw new Error("Misja wymaga kompletnej drużyny 3–4 bohaterów.");
  const snapshot = node.scenarioSnapshot;
  const missionSeed = seed ?? snapshot.baseSeed + (run.attemptsByNodeId[nodeId] ?? 0);
  if (!Number.isSafeInteger(missionSeed)) throw new Error("Nieprawidłowy seed.");
  const map = snapshot.mapMode === "regenerate" ? generateScenarioMap(missionSeed, snapshot.mapEnvironment, scenarioTemplateById.get(snapshot.presetId)?.requiresObjectives ?? false) : structuredClone(snapshot.map);
  if (snapshot.mapMode === "fixed" && snapshot.monsterPositions) map.monsterStart = structuredClone(snapshot.monsterPositions);
  const assessment = assessDifficulty(heroes, state.loadouts, snapshot.monsterIds, snapshot.presetId);
  const level = Math.max(1, Math.round(heroes.reduce((sum, h) => sum + h.level, 0) / heroes.length));
  const scenarioId = `campaign-${run.id}-${node.id}-${missionSeed}`;
  const reward = createRewardBundle(missionSeed, scenarioId, snapshot.presetId, level, node.kind === "boss", assessment.label, party.id, heroes, encounterThemeById.get(snapshot.encounterThemeId)?.rewardTable.preferredTags);
  const scenario: ScenarioDefinition = { ...buildScenarioTemplate(snapshot.presetId, map, node.name), id: scenarioId, description: snapshot.description, encounterThemeId: snapshot.encounterThemeId, events: structuredClone(snapshot.events), encounter: { id: scenarioId, name: node.name, monsters: [...snapshot.monsterIds], seedOffset: snapshot.presetId.length * 37 }, persistentRewards: true, rewardBundle: reward, rewardXp: reward.xp, difficultyRatio: assessment.ratio, partyPower: assessment.party.total, encounterPower: assessment.encounter.total };
  if (snapshot.presetId === "ritual-disruption" && snapshot.encounterThemeId === "undead-crypt") { scenario.victoryCondition = "template-rules"; scenario.victoryRules = { type: "unit-defeated", definitionId: "wraith" }; }
  return { seed: missionSeed, heroes: structuredClone(heroes), scenario, assessment, reward };
}

export function launchCampaignNode(state: CampaignState, runId: string, nodeId: string, battleId: string = crypto.randomUUID(), seed?: number) {
  const run = state.campaignRuns.find((r) => r.id === runId);
  if (!run || run.partyId !== state.selectedPartyId || run.status !== "active" || getNodeStatus(run, nodeId).status !== "available") throw new Error("Wybierz właściwą drużynę i dostępną misję.");
  if (state.pendingReward) throw new Error("Najpierw odbierz oczekującą nagrodę.");
  if (state.campaignRuns.some((r) => r.pendingBattle)) throw new Error("Najpierw dokończ rozpoczętą misję przez Kontynuuj bitwę.");
  if (state.campaignRuns.some((r) => r.settledBattleIds.includes(battleId))) throw new Error("Ta próba została już rozliczona.");
  const preview = previewCampaignNode(state, runId, nodeId, seed);
  const campaignContext = { runId, campaignId: run.campaignId, nodeId, partyId: run.partyId, battleId };
  const scenario = { ...preview.scenario, campaignContext };
  const battle = createBattle(preview.seed, scenario, preview.heroes, {}, state.loadouts);
  const updated: CampaignRun = { ...run, pendingBattle: { id: battleId, nodeId, participantIds: preview.heroes.map((h) => h.id) } };
  return { battle, campaign: { ...state, campaignRuns: state.campaignRuns.map((r) => r.id === runId ? updated : r) } };
}
