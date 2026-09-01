# Game design — vertical slice

## Filary i pętla

Gra stawia na czytelną decyzję taktyczną, rozpoznawalne d20 bez księgowości pełnego D&D 3.5, krótkie starcia i uzupełniające się role bohaterów. W aktywacji jednostka wykonuje ruch i jedną akcję. Atak to `d20 + bonus` przeciw Defense Class; naturalne 1 zawsze pudłuje, naturalne 20 trafia krytycznie. Fortitude, Reflex i Will odpierają efekty.

## Zawartość wycinka

- Fighter: Shield Bash, Cleave, Guard; Armored Vanguard.
- Rogue: Sneak Attack, Evasive Step, Throw Dagger; Cunning Position.
- Cleric: Healing Word, Turn Undead, Bless; Beacon of Faith.
- Wizard: Magic Missile, Burning Hands, Web; Arcane Recovery.
- Goblin, Skeleton, Giant Spider, Ghoul i Ogre mają różne statystyki, cechy oraz doktryny AI.
- Owlbear jest zdefiniowany jako przyszły boss z dwoma stanami, ale nie jest eksponowany w UI.
- Poisoned, Burning, Frightened, Prone, Stunned, Webbed i Regenerating istnieją w danych i mają podstawowe efekty silnikowe.

Wspólny zasób `charges` ogranicza przeładowanie interfejsu.

## Oczyść kryptę

Generator najpierw tworzy trzy połączone pomieszczenia, potem raster siatki i dekorację terenu. Bohaterowie wygrywają po zniszczeniu dwóch nekromantycznych ognisk i pokonaniu wszystkich nieumarłych. Przegrywają po śmierci drużyny. Walidator gwarantuje dojście od stref startowych do celów.

## Interfejs

Plansza jest głównym elementem. Lewo: drużyna, HP i warunki. Dół: ruch i akcje z tooltipami oraz klawiszami `M`, `1–4`, `Enter`. Prawo: runda, inicjatywa, cel i dziennik rzutów. Legalny ruch jest podświetlany.

## Dalej

Następne scenariusze to „Przerwany rytuał” (limit rund i rytualista) i „Ucieczka z legowiska” (artefakt i ewakuacja). Biomy Cave/Ruins, loot, kampania i pełny boss powstaną po ustabilizowaniu pierwszego scenariusza.

