# Architektura D&D Battles

Kod domenowy jest niezależny od Reacta, PixiJS i Tauri. Stan starcia jest zwykłą strukturą danych, a operacje silnika są deterministycznymi funkcjami. Dzięki temu reguły można testować bez UI i w przyszłości przenieść do innego klienta, w tym Unity.

## Granice modułów

- `src/core/domain` — kontrakty danych: bohaterowie, zdolności, potwory, statusy, łup, mapa, scenariusz i kampania.
- `src/core/random` — seedowany generator; jedyne źródło losowości silnika.
- `src/core/map-generation` — graf pomieszczeń, rasteryzacja, strefy i walidacja łączności.
- `src/core/rules` — pathfinding, inicjatywa, legalność akcji, d20, obrażenia, rzuty obronne i statusy.
- `src/core/scenario` — definicje scenariuszy i tworzenie sesji.
- `src/core/ai` — legalni kandydaci i scoring według doktryny.
- `src/simulation` — headless runner, limit akcji i raport.
- `src/presentation` — model widoku; bez mutacji stanu.
- `src/battlefield` — renderer PixiJS i wejście użytkownika.
- `src/app` — React, orkiestracja sesji i panele.

Kierunek zależności to `app/battlefield/presentation -> core` oraz `simulation -> core`. `core` nie importuje warstw zewnętrznych.

## Mapowanie wzorców LSWB

| Wzorzec LSWB | D&D Battles | Decyzja |
| --- | --- | --- |
| `Army` | `Party` / strona potworów | Brak pojęcia armii. |
| `UnitTemplate` | `HeroClassDefinition` / `MonsterDefinition` | Osobne typy danych. |
| `UnitInstance` | `Combatant` | Pojedyncza istota w inicjatywie. |
| aktywacja armii | aktywacja jednostki | Ruch + jedna akcja. |
| map topology + placement | room graph + grid raster | Determinizm i walidacja zachowane. |
| bot action scoring | doctrine scoring | Cel scenariusza może otrzymać własną wagę. |
| mission engine | `ScenarioDefinition` + evaluator | Bez Galactic Conquest. |
| balance batch | `runHeadlessSimulation` | Wynik, tury, ocalałe jednostki i pętle. |
| presentation profile | `BattlefieldViewModel` | Renderer nie zna reguł. |

Nie kopiujemy UI, assetów, danych ani terminologii LSWB. Repozytorium referencyjne posłużyło wyłącznie do analizy granic modułów i wzorców testów.

## Determinizm i persystencja

Każda ekspedycja ma seed, a stan przechowuje stan PRNG. `CampaignSave` ma od początku wersję schematu, drużynę, wyposażenie, odblokowania i seed ostatniej ekspedycji. Adapter zapisu pozostaje w warstwie aplikacji.

