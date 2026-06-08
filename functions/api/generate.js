import { computeChart } from '../../src/astroEngine.js';

export async function onRequestPost(context) {
  try {
    const { date, time, place, gender, name, lat, lon } = await context.request.json();
    const apiKey = context.env.OPENAI_API_KEY;

    if (!date || !time || !place) {
      return new Response(JSON.stringify({ error: "Unvollständige Geburtskoordinaten übermittelt." }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const clientName = name || "Klient/in";
    const prSubjekt = gender === "weiblich" ? "Sie" : gender === "männlich" ? "Er" : "Diese Persönlichkeit";
    const prBesitz = gender === "weiblich" ? "ihre" : gender === "männlich" ? "seine" : "die";

    // --- 1. VALIDIERTE ASTRONOMISCHE ENGINE (astronomy-engine, gegen NASA JPL Horizons getestet) ---
    //     Geozentrisch, tropisch, echtes Placidus-Häusersystem, korrekte Zeitzonen-/Sommerzeitumrechnung.
    const chart = computeChart({ date, time, lat, lon, place });
    const planetPositions   = chart.planets;
    const housePositions    = chart.houses;
    const calculatedAspects = chart.aspects;
    const elements          = chart.elements;

    const aspectString = calculatedAspects.map(a => `Das ${a.asp} von ${a.p1} zu ${a.p2} (Orbis ${a.orb})`).join(', ');


    // --- 3. PSYCHOLOGISCHES STREAM-PROMPTING (Fokus: Reibung, Schattendynamik, C.G. Jung) ---
    const systemPrompt = `Du bist ein tiefenpsychologischer Astrologe und Supervisor mit klinisch-neuropsychologischem Hintergrund.
Deine Aufgabe ist es, ein präzises Charakterprofil im anspruchsvollen literarischen Stil von C.G. Jung zu erstellen.
WICHTIG: Arbeite Brüche, unbewusste Konflikte, Quadrate und Schattenthemen schonungslos heraus. Das Leben besteht aus Reibung.
Nutze exakt folgende Abschnitte mit den Tags:
'### 1. Energetische Matrix & Grundstruktur'
'### 2. Psychologische Sollbruchstellen & Schattendynamik'
'### 3. Integrationspfad & Individuation'`;

    const userPrompt = `Analysiere die Radixkonstellation für ${clientName} (${gender}):
Dominanz: ${Object.keys(elements).reduce((a, b) => elements[a] > elements[b] ? a : b)}
Aspekte: ${aspectString || "Feine unbewusste Strömungen"}.`;

    if (apiKey && apiKey !== "dein_geheimer_api_key_hier") {
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
          stream: true
        })
      });

      return new Response(aiResponse.body, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" }
      });
    }

    // --- KLINISCHER FALLBACK-STREAM ---
    const textOutputPayload = `### 1. Energetische Matrix & Grundstruktur
Das mathematische Frequenzbild für **${clientName}** zeichnet eine psychische Landschaft von intensiver struktureller Dynamik. Mit einer signifikanten Gewichtung des Elements **${Object.keys(elements).reduce((a, b) => elements[a] > elements[b] ? a : b)}** operiert das Bewusstsein auf einer hochfrequenten Ebene.

${prSubjekt} neigt dazu, die äußere Realität ununterbrochen analytisch zu sezieren, während unbewusste, archaische Strömungen zeitgleich nach ungefiltertem Ausdruck verlangen. Diese Polarität erzeugt eine permanente Grundspannung im System.

---
### 2. Psychologische Sollbruchstellen & Schattendynamik
In Entsprechung des expliziten klinischen Befunds offenbart die Aspekt-Matrix fundamentale, ungeschönte Triebkonflikte: ${aspectString || 'Akute unbewusste Spannungsfelder'}. Hier liegt die eigentliche Bruchlinie der Persönlichkeit.

Es zeigt sich eine neurotische Ambivalenz: Ein brennender Autonomieanspruch kollidiert frontal mit einer tief sitzenden, unbewussten Angst vor Kontrollverlust. Diese Reibung äußert sich im Alltag oft als plötzliche Verhaltens-Widersprüche oder psychosomatische Blockaden. ${prSubjekt} projiziert innere Zerrissenheit häufig auf das Umfeld, um der schmerzhaften Konfrontation mit dem eigenen Schatten auszuweichen. Diese Reibungspunkte sind unnachgiebig und fordern ihren Tribut.

---
### 3. Integrationspfad & Individuation
Der therapeutische Individuationsprozess für **${clientName}** verweigert sich jedem billigen Kompromiss. Heilung bedeutet hier nicht das Nivellieren oder Glätten dieser Abgründe, sondern das Aushalten und Integrieren der inneren Gegensätze. Erst wenn die Reibung als notwendiges Feuer der Transformation akzeptiert wird, synthetisieren sich Logik und Schatten zu einer unerschütterlichen, reifen Souveränität.`;

    const encoder = new TextEncoder();
    const tokens = textOutputPayload.split(' ');
    let tokenIndex = 0;

    const stream = new ReadableStream({
      start(controller) {
        const interval = setInterval(() => {
          if (tokenIndex < tokens.length) {
            const jsonLine = `data: ${JSON.stringify({
              choices: [{ delta: { content: tokens[tokenIndex] + " " } }],
              planets: planetPositions,
              houses: housePositions,
              aspects: calculatedAspects,
              elements: elements
            })}\n\n`;
            controller.enqueue(encoder.encode(jsonLine));
            tokenIndex++;
          } else {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            clearInterval(interval);
            controller.close();
          }
        }, 20);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}