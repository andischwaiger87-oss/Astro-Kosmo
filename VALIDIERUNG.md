# Astro-Kosmo-Studio — Validierung der Berechnungs-Engine

**Stand:** Juni 2026 · **Kundenfeedback adressiert:** „Radix mit Rohdaten stimmen tw. überhaupt nicht."

## Ursache des Fehlers (vorher)

Die alte Engine (`generateDynamicAstroData`) war trotz Bezeichnungen wie „NASA-JPL DE431
Parität" **nicht fundiert**:

- **Merkur & Venus** wurden über frei erfundene Pseudo-Formeln an die Sonne gehängt
  (`23.44 * sin((200 + T*149000)…)`) → Positionen praktisch zufällig.
- **Mars–Pluto** nutzten nur mittlere Längen ohne Bahnkorrektur → mehrere Grad Fehler.
- **Mond** nutzte nur einen einzigen Störterm → bis ~5° Abweichung.
- **Häuser/„Placidus"** waren reine Fiktion (eine `sin`-Verzerrung auf RAMC), ohne echten
  Aszendenten/MC.
- **Keine Zeitzonen-/Sommerzeitumrechnung** → Aszendent bis zu 30° falsch.

## Lösung (jetzt)

Eine einzige, validierte Engine (`src/astroEngine.js`, inline auch in `index.html`):

- **Ephemeride:** `astronomy-engine` (MIT-Lizenz, gegen NASA JPL Horizons getestet,
  ~1 Bogenminute genau), inline eingebettet → keine Laufzeit-Abhängigkeit.
- **Positionen:** geozentrisch, tropisch, scheinbare Ekliptiklänge der Epoche
  (wahre Ekliptik des Datums).
- **Häuser:** echtes **Placidus**-System mit korrektem Aszendenten/MC (Standardformeln,
  iterative Zeitteilung der Halbbögen).
- **Zeit:** lokale Wanduhrzeit → UTC inkl. historischer Sommerzeit über die IANA/ICU-
  Zeitzonendatenbank (Europe/Vienna, Europe/Berlin, Europe/Zurich).

## Verifikation gegen Referenzcharts (astro.com / astro-seek, DE431, Placidus)

| Chart | Sonne | Mond | Aszendent | MC | Häuser 1–12 |
|---|---|---|---|---|---|
| **A. Einstein** (1879, Ulm, LMT) | 23°30′ ✓ | 14°32′ ✓ | 11°38′ Krebs (Ref 11°39′) | 12°49′ (Ref 12°50′) | ✓ ≤1′ |
| **A. Schwarzenegger** (1947, Thal, Sommerzeit) | 6°05′ ✓ | — | 19°05′ Krebs ✓ | 24°20′ Fische ✓ | ✓ |
| **A. Merkel** (1954, Hamburg, CET) | 24°34′ (Ref 24°33′) | 15°27′ ✓ | 16°31′ Schütze (Ref 16°30′) | 21°37′ (Ref 21°35′) | **alle 12 ✓ ≤3′** |

Alle 10 Planeten je Chart auf **1–3 Bogenminuten** genau. Zusätzlich:

- **Geometrie-Batterie:** 400 Zufalls-Radizes (1920–2024, 35–60° N) — MC-Formel,
  Aszendent (Höhe exakt 0° am Osthorizont) und Placidus-Zeitteilung jeweils
  **bogensekunden-genau**.
- **Zeitzonen:** CEST/CET 2024, Nachkriegs-Sommerzeit 1947, sommerzeitfreie Periode
  1950–1979 (Merkel 1954 = CET, identische UT wie astro-seek).

## Bewusste Qualitätsentscheidungen

- **Mondknoten:** wahrer Knoten (entspricht dem Standard-Radix von astro.com).
- **Chiron & Lilith entfernt:** Chiron erfordert eine dedizierte Asteroiden-Ephemeride
  (client-seitig nicht korrekt berechenbar); Lilith ist je nach mittlerer/wahrer
  Definition mehrdeutig. Statt potenziell falscher Werte werden nur verifizierte Punkte
  angezeigt. Beide können bei Bedarf mit geprüfter Quelle ergänzt werden.

## Geänderte Dateien

- `index.html` — kaputte Engine ersetzt, validierte Ephemeride inline.
- `src/astroEngine.js` — neue gemeinsame Engine (ES-Modul).
- `functions/api/generate.js` — Server nutzt dieselbe Engine für den KI-Text.
- `src/App.jsx` — React-Variante rechnet client-seitig mit derselben Engine (inkl. Koordinaten).
- `package.json` — Dependency `astronomy-engine`.
