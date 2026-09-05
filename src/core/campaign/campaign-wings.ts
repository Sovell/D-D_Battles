import type { CampaignState, SavedScenario } from "../domain/types";
import { validateSavedScenario } from "../scenario/saved-scenarios";
import { validateDungeonMap } from "../map-generation/crypt-generator";
import { validateScenarioEvents } from "../scenario/scenario-events";
import { itemById } from "../equipment/items";

export interface CampaignNode {
  id: string; name: string; kind: "wing" | "side" | "boss";
  scenarioSnapshot: SavedScenario; sourceScenarioId?: string;
  prerequisites: { completedNodeIds?: string[]; requiredFlags?: string[] };
  grantsFlags?: string[];
  milestoneReward?: { gold?: number; materials?: number; guaranteedItemIds?: string[] };
  displayOrder: number;
}
export interface CampaignDefinition {
  id: string; schemaVersion: 1; name: string; description: string;
  suggestedLevel?: { min: number; max: number };
  createdAt: string; updatedAt: string; nodes: CampaignNode[];
}
export interface CampaignBattleContext { runId: string; campaignId: string; nodeId: string; partyId: string; battleId: string }
export interface CampaignRun {
  id: string; campaignId: string; partyId: string; campaignSnapshot: CampaignDefinition;
  status: "active" | "completed"; startedAt: string; updatedAt: string;
  completedNodeIds: string[]; flags: string[]; attemptsByNodeId: Record<string, number>; claimedMilestoneNodeIds: string[];
  /** Durable receipt prevents replaying old saves, including failed attempts. */
  settledBattleIds: string[];
  pendingBattle?: { id: string; nodeId: string; participantIds: string[] };
}
export type NodeStatus = { status: "completed" | "available" | "locked"; reasons: string[] };
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === "string" && v.trim().length > 0);
const unique = (values: string[]) => new Set(values).size === values.length;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const nonnegative = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;

export function validateCampaignDefinition(value: unknown): string[] {
  try {
    if (!record(value)) return ["Brak definicji kampanii."];
    const d = value as unknown as CampaignDefinition;
    if (d.schemaVersion !== 1 || [d.id, d.name, d.description, d.createdAt, d.updatedAt].some((v) => typeof v !== "string" || !v.trim()) || !Array.isArray(d.nodes) || !d.nodes.length) return ["Nieprawidłowe metadane lub pusta kampania."];
    if (d.suggestedLevel && (!nonnegative(d.suggestedLevel.min) || !nonnegative(d.suggestedLevel.max) || d.suggestedLevel.min < 1 || d.suggestedLevel.max > 5 || d.suggestedLevel.min > d.suggestedLevel.max)) return ["Sugerowany poziom musi mieścić się w zakresie 1–5."];
    const errors: string[] = [];
    const ids = d.nodes.map((n) => n?.id);
    if (!strings(ids) || !unique(ids)) return ["Identyfikatory węzłów muszą być unikalne i niepuste."];
    for (const n of d.nodes) {
      if (!n.name?.trim() || !["wing", "side", "boss"].includes(n.kind) || !Number.isSafeInteger(n.displayOrder) || !record(n.prerequisites)) { errors.push("Nieprawidłowy węzeł."); continue; }
      if (validateSavedScenario(n.scenarioSnapshot).length || !validateScenarioEvents(n.scenarioSnapshot.events) || !validateDungeonMap({ ...n.scenarioSnapshot.map, monsterStart: n.scenarioSnapshot.mapMode === "fixed" && n.scenarioSnapshot.monsterPositions ? n.scenarioSnapshot.monsterPositions : n.scenarioSnapshot.map.monsterStart }, 4, n.scenarioSnapshot.monsterIds.length).valid || n.scenarioSnapshot.map.theme === "cave" || n.scenarioSnapshot.presetId === "escape") errors.push(`${n.name}: nieprawidłowy lub nieobsługiwany snapshot scenariusza.`);
      for (const list of [n.prerequisites.completedNodeIds, n.prerequisites.requiredFlags, n.grantsFlags]) if (list !== undefined && (!strings(list) || !unique(list))) errors.push(`${n.name}: nieprawidłowe zależności lub flagi.`);
      if ((n.prerequisites.completedNodeIds ?? []).some((id) => id === n.id || !ids.includes(id))) errors.push(`${n.name}: wymaganie wskazuje siebie lub nieznany węzeł.`);
      const reward = n.milestoneReward;
      if (reward && (!record(reward) || [reward.gold, reward.materials].some((v) => v !== undefined && !nonnegative(v)) || reward.guaranteedItemIds !== undefined && (!strings(reward.guaranteedItemIds) || reward.guaranteedItemIds.some((id) => !itemById.has(id))))) errors.push(`${n.name}: nieprawidłowa nagroda etapowa.`);
    }
    if (errors.length) return errors;
    // Treat flag producers as dependencies as well: an unattainable flag must not deadlock a run.
    const reachable = new Set<string>(); const flags = new Set<string>();
    for (let pass = 0; pass < d.nodes.length; pass++) for (const n of d.nodes) {
      if ((n.prerequisites.completedNodeIds ?? []).every((id) => reachable.has(id)) && (n.prerequisites.requiredFlags ?? []).every((flag) => flags.has(flag))) { reachable.add(n.id); n.grantsFlags?.forEach((flag) => flags.add(flag)); }
    }
    if (reachable.size !== d.nodes.length) errors.push("Cykl zależności lub flaga niemożliwa do zdobycia blokuje kampanię.");
    return errors;
  } catch { return ["Uszkodzona definicja kampanii."]; }
}

export function parseCampaignDefinition(raw: string): CampaignDefinition {
  const value: unknown = JSON.parse(raw); const errors = validateCampaignDefinition(value);
  if (errors.length) throw new Error(errors.join(" "));
  return structuredClone(value as CampaignDefinition);
}
export function saveCampaignDefinition(state: CampaignState, definition: CampaignDefinition): CampaignState {
  const errors = validateCampaignDefinition(definition); if (errors.length) throw new Error(errors.join(" "));
  return { ...state, campaignDefinitions: [...state.campaignDefinitions.filter((d) => d.id !== definition.id), structuredClone(definition)] };
}
export function getNodeStatus(run: CampaignRun, nodeId: string): NodeStatus {
  const node = run.campaignSnapshot.nodes.find((n) => n.id === nodeId);
  if (!node) return { status: "locked", reasons: ["Nieznany węzeł."] };
  if (run.completedNodeIds.includes(nodeId)) return { status: "completed", reasons: [] };
  const reasons = [...(node.prerequisites.completedNodeIds ?? []).filter((id) => !run.completedNodeIds.includes(id)).map((id) => `Ukończ: ${run.campaignSnapshot.nodes.find((n) => n.id === id)?.name ?? id}`), ...(node.prerequisites.requiredFlags ?? []).filter((flag) => !run.flags.includes(flag)).map((flag) => `Brak flagi: ${flag}`)];
  return { status: reasons.length ? "locked" : "available", reasons };
}
export function getAvailableNodes(run: CampaignRun): CampaignNode[] { return run.campaignSnapshot.nodes.filter((n) => getNodeStatus(run, n.id).status === "available").sort((a, b) => a.displayOrder - b.displayOrder); }
export function startCampaignRun(state: CampaignState, campaignId: string, partyId: string, id: string = crypto.randomUUID(), now = new Date().toISOString()): CampaignState {
  const definition = state.campaignDefinitions.find((d) => d.id === campaignId);
  if (!definition || !state.parties.some((p) => p.id === partyId && p.memberIds.length >= 3) || state.campaignRuns.some((r) => r.id === id || r.partyId === partyId && r.campaignId === campaignId && r.status === "active")) throw new Error("Wyprawa już trwa lub brakuje definicji / drużyny 3–4 bohaterów.");
  if (validateCampaignDefinition(definition).length) throw new Error("Nieprawidłowa definicja kampanii.");
  const run: CampaignRun = { id, campaignId, partyId, campaignSnapshot: structuredClone(definition), status: "active", startedAt: now, updatedAt: now, completedNodeIds: [], flags: [], attemptsByNodeId: {}, claimedMilestoneNodeIds: [], settledBattleIds: [] };
  return { ...state, campaignRuns: [...state.campaignRuns, run] };
}
export function validCampaignContext(state: CampaignState, context: CampaignBattleContext): CampaignRun | undefined {
  const run = state.campaignRuns.find((r) => r.id === context.runId);
  return run && run.status === "active" && run.campaignId === context.campaignId && run.partyId === context.partyId && state.selectedPartyId === context.partyId && state.parties.some((p) => p.id === context.partyId) && run.pendingBattle?.id === context.battleId && run.pendingBattle.nodeId === context.nodeId && !run.settledBattleIds.includes(context.battleId) && getNodeStatus(run, context.nodeId).status === "available" ? run : undefined;
}
export function recordCampaignVictory(state: CampaignState, context: CampaignBattleContext, now = new Date().toISOString()): CampaignState { return recordResult(state, context, true, now); }
export function recordCampaignDefeat(state: CampaignState, context: CampaignBattleContext, now = new Date().toISOString()): CampaignState { return recordResult(state, context, false, now); }
function recordResult(state: CampaignState, context: CampaignBattleContext, victory: boolean, now: string): CampaignState {
  const run = validCampaignContext(state, context); if (!run) return state;
  const node = run.campaignSnapshot.nodes.find((n) => n.id === context.nodeId)!;
  const completedNodeIds = victory ? [...run.completedNodeIds, node.id] : run.completedNodeIds;
  const milestone = victory && !run.claimedMilestoneNodeIds.includes(node.id) ? node.milestoneReward : undefined;
  const parties = state.parties.map((party) => {
    if (party.id !== run.partyId || !milestone) return party;
    // Guaranteed rewards may exceed ordinary stash stack limits; never discard them.
    const stash = structuredClone(party.stash);
    for (const id of milestone.guaranteedItemIds ?? []) {
      const stack = stash.find((s) => s.definitionId === id);
      if (stack) stack.quantity++; else stash.push({ definitionId: id, quantity: 1 });
    }
    return { ...party, stash, gold: party.gold + (milestone.gold ?? 0), materials: party.materials + (milestone.materials ?? 0) };
  });
  const nextRun: CampaignRun = { ...run, completedNodeIds, flags: victory ? [...new Set([...run.flags, ...(node.grantsFlags ?? [])])] : run.flags, attemptsByNodeId: victory ? run.attemptsByNodeId : { ...run.attemptsByNodeId, [node.id]: (run.attemptsByNodeId[node.id] ?? 0) + 1 }, claimedMilestoneNodeIds: victory ? [...run.claimedMilestoneNodeIds, node.id] : run.claimedMilestoneNodeIds, status: completedNodeIds.length === run.campaignSnapshot.nodes.length ? "completed" : "active", updatedAt: now, pendingBattle: undefined, settledBattleIds: [...run.settledBattleIds, context.battleId] };
  return { ...state, parties, inventory: parties.find((p) => p.id === state.selectedPartyId)!.stash, campaignRuns: state.campaignRuns.map((r) => r.id === run.id ? nextRun : r) };
}

export function validateCampaignRuns(value: unknown, partyIds: string[]): value is CampaignRun[] {
  try {
    if (!Array.isArray(value) || !unique(value.map((r) => r.id))) return false;
    const active = new Set<string>();
    return value.every((r: CampaignRun) => {
      if (!r || typeof r.id !== "string" || !r.id || typeof r.startedAt !== "string" || typeof r.updatedAt !== "string" || !partyIds.includes(r.partyId) || validateCampaignDefinition(r.campaignSnapshot).length || r.campaignSnapshot.id !== r.campaignId || !["active", "completed"].includes(r.status)) return false;
      const key = JSON.stringify([r.partyId, r.campaignId]); if (r.status === "active" && active.has(key)) return false; if (r.status === "active") active.add(key);
      const nodes = r.campaignSnapshot.nodes;
      if (![r.completedNodeIds, r.flags, r.claimedMilestoneNodeIds, r.settledBattleIds].every((list) => strings(list) && unique(list)) || !record(r.attemptsByNodeId)) return false;
      if (r.completedNodeIds.some((id) => !nodes.some((n) => n.id === id)) || r.claimedMilestoneNodeIds.length !== r.completedNodeIds.length || r.claimedMilestoneNodeIds.some((id) => !r.completedNodeIds.includes(id))) return false;
      const flags = [...new Set(nodes.filter((n) => r.completedNodeIds.includes(n.id)).flatMap((n) => n.grantsFlags ?? []))];
      if (r.flags.length !== flags.length || r.flags.some((f) => !flags.includes(f))) return false;
      if (Object.entries(r.attemptsByNodeId).some(([id, count]) => !nodes.some((n) => n.id === id) || !nonnegative(count))) return false;
      if ((r.status === "completed") !== (r.completedNodeIds.length === nodes.length)) return false;
      if (nodes.filter((n) => r.completedNodeIds.includes(n.id)).some((n) => (n.prerequisites.completedNodeIds ?? []).some((id) => !r.completedNodeIds.includes(id)) || (n.prerequisites.requiredFlags ?? []).some((f) => !r.flags.includes(f)))) return false;
      if (r.pendingBattle && (typeof r.pendingBattle.id !== "string" || !r.pendingBattle.id || r.settledBattleIds.includes(r.pendingBattle.id) || !strings(r.pendingBattle.participantIds) || !unique(r.pendingBattle.participantIds) || r.pendingBattle.participantIds.length < 3 || r.pendingBattle.participantIds.length > 4 || getNodeStatus(r, r.pendingBattle.nodeId).status !== "available" || r.status !== "active")) return false;
      return true;
    });
  } catch { return false; }
}
