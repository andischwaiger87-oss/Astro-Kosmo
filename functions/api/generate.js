import { computeChart } from '../../src/astroEngine.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { date, time, place, gender, name, lat, lon } = body;
    const mode = ['kurz', 'lang', 'staerken', 'schwaechen'].includes(body.mode) ? body.mode : 'kurz';
    const apiKey = context.env.OPENAI_API_KEY;

    if (!date || !time || !place) {
      return new Response(JSON.stringify({ error: "Unvollständige Geburtskoordinaten übermittelt." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const clientName = name || "Klient/in";
    const prSubjekt = gender === "weiblich" ? "Sie" : gender === "männlich" ? "Er" : "Diese Persönlichkeit";
    const prBesitz  = gender === "weiblich" ? "ihre" : gender === "männlich" ? "seine" : "die";

    // --- VALIDIERTE ASTRONOMISCHE ENGINE (astronomy-engine, gegen NASA JPL Horizons getestet) ---
    const chart = computeChart({ date, time, lat, lon, place });
    const planetPositions   = chart.planets;
    const housePositions    = chart.houses;
    const calculatedAspects = chart.aspects;
    const elements          = chart.elements;

    const aspectString = calculatedAspects.map(a => `${a.p1} ${a.asp} ${a.p2} (Orbis ${a.orb})`).join(', ');
    const harmon = calculatedAspects.filter(a => a.asp === 'Trigon' || a.asp === 'Sextil');
    const tense  = calculatedAspects.filter(a => a.asp === 'Quadrat' || a.asp === 'Opposition');
    const listAsp = arr => arr.length ? arr.map(a => `${a.p1} ${a.asp} ${a.p2} (${a.orb})`).join(', ') : 'keine markanten';

    const ascSign = housePositions['Haus 1'].sign;
    const mcSign  = housePositions['Haus 10'].sign;
    const domElement = Object.keys(elements).reduce((a, b) => elements[a] >= elements[b] ? a : b);
    const planetLine = Object.entries(planetPositions)
      .map(([n, p]) => `${n} ${p.deg.toFixed(1)}° ${p.sign} (Haus ${p.house})`).join(', ');
    const chartSummary =
      `Sonne in ${planetPositions.Sonne.sign}, Mond in ${planetPositions.Mond.sign}, Aszendent in ${ascSign}, MC in ${mcSign}. ` +
      `Planetenstände: ${planetLine}. ` +
      `Elementeverteilung: Feuer ${elements.Feuer}, Erde ${elements.Erde}, Luft ${elements.Luft}, Wasser ${elements.Wasser} (dominant: ${domElement}). ` +
      `Aspekte: ${aspectString || 'keine markanten'}.`;

    const persona =
      `Du bist ein tiefenpsychologischer Astrologe und Supervisor mit klinisch-neuropsychologischem Hintergrund. ` +
      `Du schreibst im anspruchsvollen, literarisch-präzisen Stil von C. G. Jung, auf Deutsch. ` +
      `Sprich über die Person in der dritten Person (${prSubjekt} / ${prBesitz}). ` +
      `Beziehe dich konkret und nachvollziehbar auf die genannten Stellungen, Häuser und Aspekte, ` +
      `wiederhole die Rohdaten aber nicht tabellarisch. Verwende für Zwischenüberschriften ausschließlich das Format '### Überschrift'.`;

    // --- VARIANTEN-KONFIGURATION ---
    const MODES = {
      kurz: {
        label: 'Kurzfassung',
        maxTokens: 750,
        instruction:
`Erstelle eine prägnante, treffende KURZFASSUNG mit exakt diesen drei Abschnitten:
'### 1. Energetische Matrix & Grundstruktur'
'### 2. Psychologische Sollbruchstellen & Schattendynamik'
'### 3. Integrationspfad & Individuation'
Pro Abschnitt ein kompakter, dichter Absatz.`
      },
      lang: {
        label: 'Langfassung',
        maxTokens: 1900,
        instruction:
`Erstelle eine ausführliche, tiefgehende LANGFASSUNG mit exakt diesen Abschnitten:
'### 1. Grundstruktur & Temperament (Sonne, Mond, Aszendent)'
'### 2. Mentale & emotionale Dynamik'
'### 3. Antrieb, Wille & Beziehungsfähigkeit'
'### 4. Psychologische Sollbruchstellen & Schattendynamik'
'### 5. Berufung & Lebensthema (MC und betonte Häuser)'
'### 6. Integrationspfad & Individuation'
Pro Abschnitt zwei bis drei fundierte Absätze.`
      },
      staerken: {
        label: 'Stärken',
        maxTokens: 1050,
        instruction:
`Erstelle eine Analyse mit ausschließlichem Fokus auf RESSOURCEN, TALENTE und STÄRKEN. ` +
`Hebe unterstützende Aspekte (Trigone, Sextile, gelungene Konjunktionen), gut gestellte Planeten und das dominante Element hervor. ` +
`Ton: konstruktiv, ermutigend, aber präzise. Abschnitte:
'### Kernstärken'
'### Talente & Ressourcen'
'### Entfaltung im Alltag'`
      },
      schwaechen: {
        label: 'Schwächen & Wachstum',
        maxTokens: 1050,
        instruction:
`Erstelle eine Analyse mit Fokus auf HERAUSFORDERUNGEN und WACHSTUMSFELDER. ` +
`Arbeite Spannungsaspekte (Quadrate, Oppositionen) und herausfordernde Stellungen heraus — IMMER konstruktiv und entwicklungsorientiert, ` +
`als Reibung, die Entwicklung ermöglicht. Vermeide deterministische, entmutigende oder pathologisierende Aussagen. Abschnitte:
'### Spannungsfelder'
'### Wiederkehrende Muster'
'### Wachstumsaufgaben & Lösungsansätze'`
      }
    };
    const cfg = MODES[mode];

    const systemPrompt = `${persona}\n\n${cfg.instruction}`;
    const userPrompt =
      `Erstelle die ${cfg.label} für ${clientName} (${gender}).\n` +
      `Radix-Daten: ${chartSummary}`;

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
          temperature: 0.85,
          max_tokens: cfg.maxTokens,
          stream: true
        })
      });

      return new Response(aiResponse.body, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" }
      });
    }

    // --- FALLBACK-STREAM (ohne API-Key): variantenabhängig, datenbasiert ---
    const FB = {
      kurz:
`### 1. Energetische Matrix & Grundstruktur
Das Frequenzbild für **${clientName}** zeigt mit Sonne in **${planetPositions.Sonne.sign}**, Mond in **${planetPositions.Mond.sign}** und Aszendent in **${ascSign}** eine Grundstruktur von klarer Signatur. Das dominante Element **${domElement}** prägt Wahrnehmung und Ausdruck.

### 2. Psychologische Sollbruchstellen & Schattendynamik
Die Aspekt-Matrix verweist auf reale Spannungsfelder: ${listAsp(tense)}. Hier liegt die Bruchlinie, an der sich unbewusste Konflikte zeigen.

### 3. Integrationspfad & Individuation
Reifung bedeutet, die Gegensätze auszuhalten und zu integrieren — nicht zu glätten. Die unterstützenden Verbindungen (${listAsp(harmon)}) bieten dafür tragfähige Ressourcen.`,
      lang:
`### 1. Grundstruktur & Temperament (Sonne, Mond, Aszendent)
Mit Sonne in **${planetPositions.Sonne.sign}** (Haus ${planetPositions.Sonne.house}), Mond in **${planetPositions.Mond.sign}** (Haus ${planetPositions.Mond.house}) und Aszendent in **${ascSign}** entsteht das Kerngerüst der Persönlichkeit von **${clientName}**. Das dominante Element **${domElement}** gibt den Grundton vor.

### 2. Mentale & emotionale Dynamik
Merkur in ${planetPositions.Merkur.sign} und der Mond in ${planetPositions.Mond.sign} beschreiben Denkstil und Gefühlshaushalt sowie ihr Zusammenspiel.

### 3. Antrieb, Wille & Beziehungsfähigkeit
Mars in ${planetPositions.Mars.sign} und Venus in ${planetPositions.Venus.sign} zeigen Durchsetzung, Begehren und Beziehungsmuster.

### 4. Psychologische Sollbruchstellen & Schattendynamik
Spannungsaspekte: ${listAsp(tense)}. Sie markieren die zentralen inneren Reibungspunkte.

### 5. Berufung & Lebensthema (MC und betonte Häuser)
Der MC in **${mcSign}** weist auf das öffentliche Lebensthema und die Richtung der Selbstverwirklichung.

### 6. Integrationspfad & Individuation
Die unterstützenden Aspekte (${listAsp(harmon)}) tragen den Individuationsprozess: Integration statt Nivellierung der Gegensätze.`,
      staerken:
`### Kernstärken
Sonne in **${planetPositions.Sonne.sign}** und Aszendent in **${ascSign}** verleihen **${clientName}** eine klare Grundausstrahlung. Das dominante Element **${domElement}** ist eine verlässliche Kraftquelle.

### Talente & Ressourcen
Unterstützende Aspekte bilden das Fundament der Begabungen: ${listAsp(harmon)}.

### Entfaltung im Alltag
Diese Ressourcen entfalten sich, wenn ${prSubjekt} sie bewusst einsetzt — in Aufgaben, die zur Signatur von Sonne, Mond und Aszendent passen.`,
      schwaechen:
`### Spannungsfelder
Die herausfordernden Aspekte zeigen, wo Reibung entsteht: ${listAsp(tense)}. Solche Spannungen sind Entwicklungsmotoren, keine Defekte.

### Wiederkehrende Muster
Wo dieselben Spannungen wiederholt auftreten, entstehen Muster — erkennbar und damit veränderbar.

### Wachstumsaufgaben & Lösungsansätze
Die Aufgabe besteht darin, die Spannungen bewusst zu halten und schrittweise zu integrieren. Die unterstützenden Verbindungen (${listAsp(harmon)}) bieten dafür konkrete Anker.`
    };
    const textOutputPayload = FB[mode];

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
        }, 18);
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
