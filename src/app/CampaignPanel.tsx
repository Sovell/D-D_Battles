import { useState } from "react";
import type { CampaignState, SavedScenario } from "../core/domain/types";
import { getNodeStatus, parseCampaignDefinition, saveCampaignDefinition, startCampaignRun, validateCampaignDefinition, type CampaignDefinition, type CampaignNode } from "../core/campaign/campaign-wings";
import { fracturedSealCampaign } from "../core/campaign/campaign-presets";
import { previewCampaignNode } from "../core/campaign/campaign-launch";
import { selectParty } from "../core/equipment/campaign";
import { itemById } from "../core/equipment/items";
import { encounterThemeById } from "../core/scenario/encounter-themes";
import { loadSavedScenarios } from "./session-storage";
import "./campaign-panel.css";

const labels = { wing: "Skrzydło", side: "Misja poboczna", boss: "Finał" };
const statusLabels = { available: "Dostępna", locked: "Zablokowana", completed: "Ukończona" };
const split = (value: string) => [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))];
const now = () => new Date().toISOString();
function blankCampaign(): CampaignDefinition { return { id: crypto.randomUUID(), schemaVersion: 1, name: "Nowa kampania", description: "Opis wyprawy", createdAt: now(), updatedAt: now(), nodes: [] }; }

export function CampaignPanel({ campaign, onChange, onLaunch, onParty, onBack, onContinue, initialRunId }: {
  campaign: CampaignState; onChange(state: CampaignState): void; onLaunch(runId: string, nodeId: string): void;
  onParty(): void; onBack(): void; onContinue(): void; initialRunId?: string;
}) {
  const [mode, setMode] = useState<"runs" | "library">("runs");
  const [definitionId, setDefinitionId] = useState(campaign.campaignDefinitions[0]?.id ?? "");
  const [runId, setRunId] = useState(initialRunId ?? campaign.campaignRuns.filter((r) => r.partyId === campaign.selectedPartyId).at(-1)?.id ?? "");
  const [nodeId, setNodeId] = useState("");
  const [draft, setDraft] = useState<CampaignDefinition>();
  const [saved] = useState(loadSavedScenarios);
  const [sourceId, setSourceId] = useState(saved[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const run = campaign.campaignRuns.find((r) => r.id === runId && r.partyId === campaign.selectedPartyId);
  const selectedNode = run?.campaignSnapshot.nodes.find((n) => n.id === nodeId) ?? run?.campaignSnapshot.nodes.slice().sort((a, b) => a.displayOrder - b.displayOrder)[0];
  const nodeState = run && selectedNode ? getNodeStatus(run, selectedNode.id) : undefined;
  let preview: ReturnType<typeof previewCampaignNode> | undefined; let previewError = "";
  try { if (run && selectedNode) preview = previewCampaignNode(campaign, run.id, selectedNode.id); } catch (error) { previewError = String(error); }
  const errors = draft ? validateCampaignDefinition(draft) : [];
  const inProgress = campaign.campaignRuns.some((r) => r.pendingBattle);
  function action(fn: () => void) { try { fn(); setMessage(""); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } }
  function updateNode(id: string, patch: Partial<CampaignNode>) { setDraft((d) => d && ({ ...d, nodes: d.nodes.map((n) => n.id === id ? { ...n, ...patch } : n) })); }
  function addNode(source: SavedScenario) {
    setDraft((d) => d && ({ ...d, nodes: [...d.nodes, { id: `node-${crypto.randomUUID()}`, name: source.name, kind: "wing", scenarioSnapshot: structuredClone(source), sourceScenarioId: source.id, prerequisites: {}, displayOrder: d.nodes.length }] }));
  }
  function moveNode(index: number, direction: number) {
    setDraft((d) => { if (!d) return d; const nodes = [...d.nodes]; const target = index + direction; if (!nodes[target]) return d; [nodes[index], nodes[target]] = [nodes[target], nodes[index]]; return { ...d, nodes: nodes.map((n, i) => ({ ...n, displayOrder: i })) }; });
  }
  async function importFile(file?: File) {
    if (!file) return;
    try { const definition = parseCampaignDefinition(await file.text()); onChange(saveCampaignDefinition(campaign, definition)); setDefinitionId(definition.id); setMessage("Zaimportowano kampanię. Istniejące wyprawy zachowują swoją treść."); } catch (error) { setMessage(String(error)); }
  }
  function exportDefinition(definition: CampaignDefinition) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(definition, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `campaign-${definition.id.replace(/[^a-z0-9-]/gi, "_")}.json`; a.click(); URL.revokeObjectURL(url);
  }
  return <main className="launcher-shell campaign-shell">
    <header className="launcher-header"><div><span className="eyebrow">SCHRONIENIE · WYPRAWY</span><h1>Kampanie</h1><p>Wybierz skrzydło, zdobądź fragmenty pieczęci i przygotuj drużynę do finału.</p></div><div className="campaign-actions"><button onClick={onParty}>Drużyny i magazyn</button><button onClick={onBack}>← Menu główne</button></div></header>
    <nav className="party-tabs" aria-label="Panel kampanii"><button className={mode === "runs" ? "selected" : ""} onClick={() => setMode("runs")}>Wyprawa drużyny</button><button className={mode === "library" ? "selected" : ""} onClick={() => setMode("library")}>Biblioteka kampanii</button></nav>
    {message && <p role="alert" className="campaign-notice">{message}</p>}
    {inProgress && <div className="campaign-notice">Misja jest w toku. Jej wynik zostanie rozliczony przed kolejnym startem. <button onClick={onContinue}>Kontynuuj bitwę</button></div>}
    {mode === "runs" ? <>
      <section className="builder-section campaign-controls">
        <label>Drużyna<select value={campaign.selectedPartyId} onChange={(e) => { const id = e.target.value; onChange(selectParty(campaign, id)); setRunId(campaign.campaignRuns.filter((r) => r.partyId === id).at(-1)?.id ?? ""); setNodeId(""); }}>{campaign.parties.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.memberIds.length} bohaterów</option>)}</select></label>
        <label>Zapisana wyprawa<select value={run?.id ?? ""} onChange={(e) => { setRunId(e.target.value); setNodeId(""); }}><option value="">Wybierz wyprawę…</option>{campaign.campaignRuns.filter((r) => r.partyId === campaign.selectedPartyId).map((r) => <option key={r.id} value={r.id}>{r.campaignSnapshot.name} · {r.status === "completed" ? "ukończona" : "w toku"} · {r.startedAt.slice(0, 10)} · {r.completedNodeIds.length}/{r.campaignSnapshot.nodes.length}</option>)}</select></label>
        <label>Nowa wyprawa<select value={definitionId} onChange={(e) => setDefinitionId(e.target.value)}><option value="">Wybierz kampanię…</option>{campaign.campaignDefinitions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <button disabled={!definitionId || campaign.campaignRuns.some((r) => r.partyId === campaign.selectedPartyId && r.campaignId === definitionId && r.status === "active")} onClick={() => action(() => { const id = crypto.randomUUID(); onChange(startCampaignRun(campaign, definitionId, campaign.selectedPartyId, id)); setRunId(id); setNodeId(""); })}>Rozpocznij wyprawę</button>
      </section>
      {!campaign.campaignDefinitions.length && <section className="builder-section"><h2>Pierwsza kampania</h2><p>Dodaj gotową „Pękniętą Pieczęć” lub połącz własne zapisane scenariusze w bibliotece.</p><button onClick={() => action(() => { const preset = fracturedSealCampaign(); onChange(saveCampaignDefinition(campaign, preset)); setDefinitionId(preset.id); })}>Dodaj „Pękniętą Pieczęć”</button><button onClick={() => setMode("library")}>Otwórz bibliotekę</button></section>}
      {run && <><section className="builder-section"><span className="eyebrow">{run.status === "completed" ? "WYPRAWA UKOŃCZONA" : "POWRÓT DO SCHRONIENIA PO KAŻDEJ MISJI"}</span><h2>{run.campaignSnapshot.name}</h2><p>{run.campaignSnapshot.description}</p><p>Postęp {run.completedNodeIds.length}/{run.campaignSnapshot.nodes.length} · Zdobyte flagi: {run.flags.join(", ") || "brak"}</p></section>
        <div className="campaign-run-layout"><section className="campaign-lanes" aria-label="Skrzydła wyprawy">{run.campaignSnapshot.nodes.slice().sort((a, b) => a.displayOrder - b.displayOrder).map((n) => { const status = getNodeStatus(run, n.id); return <button key={n.id} className={`campaign-node ${status.status} ${selectedNode?.id === n.id ? "selected" : ""}`} aria-pressed={selectedNode?.id === n.id} onClick={() => setNodeId(n.id)}><small>{labels[n.kind]} · {statusLabels[status.status]}</small><strong>{n.name}</strong><span>{status.reasons.join(" · ") || (status.status === "completed" ? "Skrzydło zaliczone" : "Drużyna może wyruszyć")}</span><small>Porażki: {run.attemptsByNodeId[n.id] ?? 0}</small></button>; })}</section>
        {selectedNode && <section className="builder-section campaign-node-details"><span className="eyebrow">{labels[selectedNode.kind]}</span><h2>{selectedNode.name}</h2><p>{selectedNode.scenarioSnapshot.description}</p><p>Motyw: {encounterThemeById.get(selectedNode.scenarioSnapshot.encounterThemeId)?.name}</p>{previewError && <p role="alert">{previewError}</p>}{preview && <><p>Cel: {preview.scenario.objectiveText}</p><div className={`difficulty-summary difficulty-${preview.assessment.label.toLowerCase()}`}><div><span>AKTUALNA TRUDNOŚĆ</span><strong>{preview.assessment.label}</strong><small>Siła drużyny {preview.assessment.party.total} · przeciwnicy {preview.assessment.encounter.total} · stosunek {preview.assessment.ratio}</small></div></div><h3>Standardowa nagroda</h3><p>{preview.reward.xp} XP dla uczestnika · {preview.reward.gold} złota · {preview.reward.materials} materiałów</p><p>Jeden przedmiot do wyboru: {preview.reward.choices.map((id) => itemById.get(id)?.name).join(" / ")}</p></>}<h3>Jednorazowa nagroda etapowa</h3><p>{milestoneText(selectedNode)}</p>{nodeState?.reasons.map((r) => <p key={r}>{r}</p>)}{selectedNode.grantsFlags?.length ? <p>Zdobywane flagi: {selectedNode.grantsFlags.join(", ")}</p> : null}<button className="launch-button" disabled={nodeState?.status !== "available" || !preview || inProgress || Boolean(campaign.pendingReward)} onClick={() => action(() => onLaunch(run.id, selectedNode.id))}>Rozpocznij misję →</button><button onClick={onParty}>Przygotuj ekwipunek w schronieniu</button></section>}</div></>}
    </> : <>
      <section className="builder-section"><div className="campaign-actions"><button onClick={() => setDraft(blankCampaign())}>Utwórz kampanię</button><button onClick={() => action(() => { const preset = fracturedSealCampaign(); onChange(saveCampaignDefinition(campaign, preset)); setDefinitionId(preset.id); })}>Dodaj preset „Pęknięta Pieczęć”</button><label className="campaign-file">Importuj JSON<input type="file" accept=".json,application/json" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></label></div>
        <div className="campaign-library">{campaign.campaignDefinitions.map((d) => <article key={d.id}><h3>{d.name}</h3><p>{d.description}</p><small>{d.nodes.length} misji · poziomy {d.suggestedLevel ? `${d.suggestedLevel.min}–${d.suggestedLevel.max}` : "dowolne"}</small><div className="campaign-actions"><button onClick={() => { setDraft(structuredClone(d)); setMessage(""); }}>Edytuj</button><button onClick={() => action(() => onChange(saveCampaignDefinition(campaign, { ...structuredClone(d), id: crypto.randomUUID(), name: `${d.name} — kopia`, createdAt: now(), updatedAt: now() })))}>Duplikuj</button><button onClick={() => exportDefinition(d)}>Eksportuj JSON</button><button onClick={() => setDeleteId(d.id)}>Usuń</button></div>{deleteId === d.id && <p>Usunąć definicję? Zapisane wyprawy zachowają swoją treść. <button onClick={() => { onChange({ ...campaign, campaignDefinitions: campaign.campaignDefinitions.filter((item) => item.id !== d.id) }); setDeleteId(""); if (definitionId === d.id) setDefinitionId(""); }}>Potwierdź usunięcie</button><button onClick={() => setDeleteId("")}>Anuluj</button></p>}</article>)}</div>
      </section>
      {draft && <section className="builder-section campaign-editor"><h2>Edytor kampanii</h2><p>Zapis aktualizuje bibliotekę. Rozpoczęte wyprawy zachowują dotychczasowe misje.</p><label>Nazwa kampanii<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>Opis kampanii<textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label><div className="campaign-controls"><label>Poziom od<input type="number" min={1} max={5} value={draft.suggestedLevel?.min ?? 1} onChange={(e) => setDraft({ ...draft, suggestedLevel: { min: Number(e.target.value), max: draft.suggestedLevel?.max ?? 5 } })} /></label><label>Poziom do<input type="number" min={1} max={5} value={draft.suggestedLevel?.max ?? 5} onChange={(e) => setDraft({ ...draft, suggestedLevel: { min: draft.suggestedLevel?.min ?? 1, max: Number(e.target.value) } })} /></label></div>
        <div className="campaign-actions"><label>Zapisany scenariusz<select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>{saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button disabled={!saved.some((s) => s.id === sourceId)} onClick={() => { const source = saved.find((s) => s.id === sourceId); if (source) addNode(source); }}>Dodaj węzeł ze scenariusza</button></div>
        {draft.nodes.map((n, index) => <article key={n.id} className="campaign-edit-node"><div className="campaign-actions"><h3>{index + 1}. {n.name}</h3><button aria-label={`Przesuń ${n.name} w górę`} disabled={!index} onClick={() => moveNode(index, -1)}>↑</button><button aria-label={`Przesuń ${n.name} w dół`} disabled={index === draft.nodes.length - 1} onClick={() => moveNode(index, 1)}>↓</button><button onClick={() => setDraft({ ...draft, nodes: draft.nodes.filter((item) => item.id !== n.id).map((item, i) => ({ ...item, displayOrder: i })) })}>Usuń węzeł</button></div><div className="campaign-controls"><label>Nazwa misji<input value={n.name} onChange={(e) => updateNode(n.id, { name: e.target.value })} /></label><label>Typ<select value={n.kind} onChange={(e) => updateNode(n.id, { kind: e.target.value as CampaignNode["kind"] })}>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div><p>Scenariusz: {n.scenarioSnapshot.name} · {n.scenarioSnapshot.encounterThemeId}</p>
          <fieldset><legend>Wymagane ukończone misje</legend>{draft.nodes.filter((other) => other.id !== n.id).map((other) => <label className="campaign-check" key={other.id}><input type="checkbox" checked={n.prerequisites.completedNodeIds?.includes(other.id) ?? false} onChange={(e) => updateNode(n.id, { prerequisites: { ...n.prerequisites, completedNodeIds: e.target.checked ? [...(n.prerequisites.completedNodeIds ?? []), other.id] : n.prerequisites.completedNodeIds?.filter((id) => id !== other.id) } })} />{other.name}</label>)}</fieldset>
          <div className="campaign-controls"><TokenField label="Wymagane flagi (po przecinku)" values={n.prerequisites.requiredFlags ?? []} onChange={(values) => updateNode(n.id, { prerequisites: { ...n.prerequisites, requiredFlags: values } })} /><TokenField label="Zdobywane flagi (po przecinku)" values={n.grantsFlags ?? []} onChange={(values) => updateNode(n.id, { grantsFlags: values })} /><label>Złoto etapowe<input type="number" min={0} value={n.milestoneReward?.gold ?? 0} onChange={(e) => updateNode(n.id, { milestoneReward: { ...n.milestoneReward, gold: Number(e.target.value) } })} /></label><label>Materiały etapowe<input type="number" min={0} value={n.milestoneReward?.materials ?? 0} onChange={(e) => updateNode(n.id, { milestoneReward: { ...n.milestoneReward, materials: Number(e.target.value) } })} /></label></div><TokenField label="Gwarantowane item ID (po przecinku)" values={n.milestoneReward?.guaranteedItemIds ?? []} onChange={(values) => updateNode(n.id, { milestoneReward: { ...n.milestoneReward, guaranteedItemIds: values } })} /><small>Katalog: {[...itemById.values()].filter((i) => i.rarity === "rare").map((i) => `${i.id} (${i.name})`).join(" · ")}</small>
        </article>)}
        {errors.length > 0 && <div role="alert">{errors.map((error, i) => <p key={i}>{error}</p>)}</div>}<div className="campaign-actions"><button disabled={errors.length > 0} onClick={() => action(() => { onChange(saveCampaignDefinition(campaign, { ...draft, updatedAt: now() })); setDefinitionId(draft.id); setDraft(undefined); })}>Zapisz kampanię</button><button onClick={() => setDraft(undefined)}>Zamknij edytor</button></div>
      </section>}
    </>}
  </main>;
}

function milestoneText(node: CampaignNode): string { const reward = node.milestoneReward; return reward ? `${reward.gold ?? 0} złota · ${reward.materials ?? 0} materiałów${reward.guaranteedItemIds?.length ? ` · ${reward.guaranteedItemIds.map((id) => itemById.get(id)?.name ?? id).join(", ")}` : ""}` : "Brak dodatkowej nagrody etapowej."; }
function TokenField({ label, values, onChange }: { label: string; values: string[]; onChange(values: string[]): void }) {
  return <label>{label}<input defaultValue={values.join(", ")} onBlur={(e) => onChange(split(e.target.value))} /></label>;
}
