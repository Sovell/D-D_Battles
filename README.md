# D&D Battles

Niezależny prototyp taktycznej gry turowej inspirowanej zasadami d20 i D&D 3.5. Projekt nie zawiera treści ani zasobów z LEGO Star Wars Battles ani skanów podręczników.

## Uruchomienie

```bash
npm install
npm run dev
```

Testy i symulacja:

```bash
npm test
npm run simulate
npm run build
```

Vertical slice zawiera generowaną kryptę, czterech bohaterów, pięć typów potworów, inicjatywę, ruch, atak d20, zdolności, warunki, AI scoringowe i cel „Oczyść kryptę”.

## Kampanie — skrzydła wypraw

W menu wybierz **Kampanie** i dodaj preset **Pęknięta Pieczęć**. Rozpocznij wyprawę istniejącą drużyną: dwa niezależne skrzydła dają flagi odblokowujące finał. Po każdej misji wracasz do schronienia, odbierasz łup i możesz zmienić wyposażenie. Finał dodatkowo gwarantuje Cloak of Resistance +2.

Własne kampanie tworzysz w **Bibliotece kampanii**, łącząc wzory zapisane w Scenario Builderze. Edytor obsługuje kolejność, zależności od misji i flag, nagrody etapowe oraz import/eksport JSON. Usunięcie lub zmiana definicji nie modyfikuje rozpoczętych wypraw: każda zachowuje osobny snapshot i historię.

Zapis CampaignState v1 migruje automatycznie do v2, zachowując bohaterów, drużyny, magazyny, waluty i historię. Klucz localStorage pozostaje ten sam. Wyniki prób mają trwałe identyfikatory zapobiegające ponownemu przyznaniu nagród i zużyciu mikstur przy wczytywaniu bitwy. Złoto i materiały kampanii rozliczane są wraz z wynikiem, a wybór przedmiotu pozostaje w oczekującej nagrodzie. Jednocześnie może trwać jedna bitwa; wrócisz do niej przez **Kontynuuj bitwę**.

Testy kampanii: `src/core/campaign/campaign-wings.test.ts`. Smoke test interfejsu: utworzenie własnej kampanii z trzech snapshotów kontrolnego scenariusza ze zdarzeniem zwycięstwa, ukończenie skrzydeł B → A, zmiana broni zapasowej i wyposażenie mikstury w magazynie, ukończenie finału, odbiór Rare oraz ponowne wczytanie postępu 3/3. Test sprawdza przepływ kampanii, nie balans potyczek presetu.
