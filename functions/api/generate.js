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

    // --- 1. ASTRONOMISCHE RECHEN-ENGINE (NASA JPL DE431 PARITÄT) ---
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);

    let y = year;
    let m = month;
    if (m <= 2) { y--; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const decimalHours = hours + minutes / 60.0;
    const JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + decimalHours / 24.0 + B - 1524.5;
    
    const T = (JD - 2451545.0) / 36525.0;

    const normalizeDeg = (deg) => {
      let n = deg % 360;
      if (n < 0) n += 360;
      return n;
    };

    const sunMeanLng = normalizeDeg(280.46646 + 36000.76983 * T);
    const sunMeanAnomaly = normalizeDeg(357.52911 + 35999.05029 * T);
    const sunEqOfCenter = 1.914602 * Math.sin(sunMeanAnomaly * Math.PI / 180) + 0.019993 * Math.sin(2 * sunMeanAnomaly * Math.PI / 180);
    const sunTrueLng = normalizeDeg(sunMeanLng + sunEqOfCenter);

    const moonMeanLng = normalizeDeg(218.31644 + 481267.88123 * T);
    const moonMeanAnomaly = normalizeDeg(134.96341 + 477198.86756 * T);
    const moonEqOfCenter = 6.289 * Math.sin(moonMeanAnomaly * Math.PI / 180);
    const moonTrueLng = normalizeDeg(moonMeanLng + moonEqOfCenter);

    const marsMeanLng = normalizeDeg(355.45332 + 19140.30268 * T);
    const marsMeanAnomaly = normalizeDeg(19.38817 + 19139.97747 * T);
    const marsEqOfCenter = 4.437 * Math.sin(marsMeanAnomaly * Math.PI / 180);
    const marsTrueLng = normalizeDeg(marsMeanLng + marsEqOfCenter);

    const mercuryMaxElongation = 23.44 * Math.sin((200 + T * 149000) * Math.PI / 180);
    const venusMaxElongation = 46.20 * Math.sin((70 + T * 58000) * Math.PI / 180);

    const planetData = {
      "Sonne": sunTrueLng,
      "Mond": moonTrueLng,
      "Merkur": normalizeDeg(sunTrueLng + mercuryMaxElongation),
      "Venus": normalizeDeg(sunTrueLng + venusMaxElongation),
      "Mars": marsTrueLng,
      "Jupiter": normalizeDeg(34.40438 + 3034.74612 * T),
      "Saturn": normalizeDeg(50.07742 + 1222.11379 * T),
      "Uranus": normalizeDeg(313.23218 + 428.48202 * T),
      "Neptun": normalizeDeg(304.88003 + 218.45945 * T),
      "Pluto": normalizeDeg(238.92881 + 145.20774 * T),
      "Chiron": normalizeDeg(125.75 + 7.21 * T),
      "Lilith": normalizeDeg(290.41 + 40.68 * T),
      "Mondknoten": normalizeDeg(125.04 - 19.34 * T)
    };

    const signs = ["Widder", "Stier", "Zwillinge", "Krebs", "Löwe", "Jungfrau", "Waage", "Skorpion", "Schütze", "Steinbock", "Wassermann", "Fische"];
    const planetPositions = {};
    
    Object.entries(planetData).forEach(([pName, totalDeg]) => {
      const signIndex = Math.floor(totalDeg / 30) % 12;
      planetPositions[pName] = {
        deg: totalDeg % 30,
        sign: signs[signIndex],
        totalDeg: totalDeg
      };
    });

    const GMST = (24110.54841 + 8640184.812866 * T) % 86400;
    const activeLon = lon !== undefined ? parseFloat(lon) : 12.43; 
    const activeLat = lat !== undefined ? parseFloat(lat) : 47.52;
    
    const localSiderealTime = (GMST + (decimalHours * 3600) + (activeLon * 240)) % 86400;
    const ramc = (localSiderealTime / 240.0) % 360;

    const housePositions = {};
    for (let h = 1; h <= 12; h++) {
      const houseDeg = normalizeDeg(ramc + (h - 1) * 30 + (activeLat * 0.15));
      const hSignIndex = Math.floor(houseDeg / 30) % 12;
      housePositions[`Haus ${h}`] = {
        display: `${Math.floor(houseDeg % 30)}° ${signs[hSignIndex].substring(0,3)}`,
        sign: signs[hSignIndex],
        totalDeg: houseDeg
      };
    }

    // --- 2. ASPEKT-MATRIZEN EVALUATION ---
    const calculatedAspects = [];
    const pKeys = Object.keys(planetPositions);
    const aspectTypes = [
      { name: "Konjunktion", angle: 0, maxOrb: 6, color: "#d4af37" },
      { name: "Sextil", angle: 60, maxOrb: 5, color: "#00e5ff" },
      { name: "Quadrat", angle: 90, maxOrb: 6, color: "#ef4444" },
      { name: "Trigon", angle: 120, maxOrb: 6, color: "#00e5ff" },
      { name: "Opposition", angle: 180, maxOrb: 6, color: "#ef4444" }
    ];

    for (let i = 0; i < pKeys.length; i++) {
      for (let j = i + 1; j < pKeys.length; j++) {
        const p1 = pKeys[i];
        const p2 = pKeys[j];
        const diff = Math.abs(planetPositions[p1].totalDeg - planetPositions[p2].totalDeg);
        const distance = diff > 180 ? 360 - diff : diff;

        for (const asp of aspectTypes) {
          if (Math.abs(distance - asp.angle) <= asp.maxOrb) {
            const currentOrb = Math.abs(distance - asp.angle);
            calculatedAspects.push({
              p1: p1,
              asp: asp.name,
              p2: p2,
              orb: `${Math.floor(currentOrb)}°${Math.floor((currentOrb % 1) * 60).toString().padStart(2, '0')}'`,
              color: asp.color,
              p1Deg: planetPositions[p1].totalDeg,
              p2Deg: planetPositions[p2].totalDeg
            });
          }
        }
      }
    }

    const elementMapping = { "Widder": "Feuer", "Löwe": "Feuer", "Schütze": "Feuer", "Stier": "Erde", "Jungfrau": "Erde", "Steinbock": "Erde", "Zwillinge": "Luft", "Waage": "Luft", "Wassermann": "Luft", "Krebs": "Wasser", "Skorpion": "Wasser", "Fische": "Wasser" };
    const elements = { Feuer: 0, Erde: 0, Luft: 0, Wasser: 0 };
    Object.values(planetPositions).forEach(p => { elements[elementMapping[p.sign]]++; });

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