import type { RewardBundle } from "../core/domain/types";
import { itemById } from "../core/equipment/items";

export function RewardScreen({ bundle, onClaim }: { bundle: RewardBundle; onClaim(itemId: string): void }) {
  return <section aria-labelledby="reward-title" aria-modal="true" className="reward-screen" role="dialog"><div><span className="eyebrow">ŁUP ZE SCENARIUSZA · {bundle.difficulty.toUpperCase()}</span><h2 id="reward-title">Wybierz jedną nagrodę</h2><p>{bundle.xp} XP dla każdego uczestnika · {bundle.gold} złota · {bundle.materials} materiałów. Wybrany przedmiot trafi do magazynu drużyny.</p><div>{bundle.choices.map((id) => { const item = itemById.get(id)!; return <article key={id}><span>{item.rarity.toUpperCase()} · POZIOM {item.levelMin}+</span><strong>{item.name}</strong><p>{item.description}</p><button onClick={() => onClaim(id)}>Wybierz</button></article>; })}</div></div></section>;
}
