import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Sparkles, FileText, Moon, HelpCircle, Compass, User, MapPin, Calendar, Clock } from 'lucide-react';
import { computeChart } from './astroEngine.js';

// Geokoordinaten (AT/DE) — identisch zur Standalone-App, für korrekte Häuser/Aszendent.
const GEONAMES = [
  { name: "St. Johann in Tirol, Österreich", lat: 47.5222, lon: 12.4278 },
  { name: "Salzburg, Österreich", lat: 47.8095, lon: 13.0550 },
  { name: "Wien, Österreich", lat: 48.2082, lon: 16.3738 },
  { name: "Graz, Österreich", lat: 47.0707, lon: 15.4395 },
  { name: "Linz, Österreich", lat: 48.3064, lon: 14.2858 },
  { name: "Innsbruck, Österreich", lat: 47.2692, lon: 11.4041 },
  { name: "Klagenfurt am Wörthersee, Österreich", lat: 46.6365, lon: 14.3122 },
  { name: "Villach, Österreich", lat: 46.6103, lon: 13.8558 },
  { name: "Bregenz, Österreich", lat: 47.5031, lon: 9.7471 },
  { name: "Berlin, Deutschland", lat: 52.5200, lon: 13.4050 },
  { name: "München, Deutschland", lat: 48.1351, lon: 11.5820 },
  { name: "Hamburg, Deutschland", lat: 53.5511, lon: 9.9937 },
  { name: "Köln, Deutschland", lat: 50.9375, lon: 6.9603 },
  { name: "Frankfurt am Main, Deutschland", lat: 50.1109, lon: 8.6821 }
];
function resolveCoords(place) {
  const p = (place || '').trim().toLowerCase();
  if (!p) return { lat: 47.8095, lon: 13.0550, place: 'Salzburg, Österreich' };
  const hit = GEONAMES.find(c => c.name.toLowerCase().includes(p) || p.includes(c.name.split(',')[0].toLowerCase()));
  return hit ? { lat: hit.lat, lon: hit.lon, place: hit.name } : { lat: 47.8095, lon: 13.0550, place };
}

export default function App() {
  const [formData, setFormData] = useState({ date: '', time: '', place: '', gender: 'weiblich', name: '' });
  const [textOutput, setTextOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('textTab');
  const [activeModal, setActiveModal] = useState(null);
  const [legalType, setLegalType] = useState('');

  const [astroData, setAstroData] = useState({ planets: null, houses: null, aspects: null, elements: null });
  const outputEndRef = useRef(null);

  useEffect(() => {
    if (isLoading && outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [textOutput, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(false);
    setIsLoading(true);
    setTextOutput('');
    setAstroData({ planets: null, houses: null, aspects: null, elements: null });

    console.group("✨ ASTRO-KOSMO-STUDIO ENGINE DIAGNOSTICS");
    console.time("⏱️ Gesamtlaufzeit Berechnung");
    console.log("📥 Absende-Payload:", formData);

    // Radix client-seitig mit der validierten Engine berechnen (geozentrisch, tropisch,
    // echtes Placidus, korrekte Zeitzone). Identische Logik wie Server & Standalone-App.
    const coords = resolveCoords(formData.place);
    let chartPayload = formData;
    try {
      const chart = computeChart({ ...formData, lat: coords.lat, lon: coords.lon, place: coords.place });
      chartPayload = { ...formData, ...coords };
      setAstroData({ planets: chart.planets, houses: chart.houses, aspects: chart.aspects, elements: chart.elements });
      console.log("🪐 Planetenpositionen:", chart.planets);
      console.log("🏠 Häuserspitzen (Placidus):", chart.houses);
      console.log("📐 Aspekt-Matrix:", chart.aspects);
    } catch (err) {
      console.error("❌ Engine-Fehler:", err);
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chartPayload)
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.replace('data: ', ''));
              const token = parsed.choices[0].delta.content;
              if (token) setTextOutput((prev) => prev + token);
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error("❌ Fehler:", error);
    } finally {
      setIsLoading(false);
      console.timeEnd("⏱️ Gesamtlaufzeit Berechnung");
      console.groupEnd();
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.width;

    doc.setFillColor(17, 20, 23);
    doc.rect(0, 0, pageWidth, 55, 'F');
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 55, pageWidth, 1, 'F');

    doc.setTextColor(212, 175, 55);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(24);
    doc.text("ASTRO-KOSMO STUDIO", 20, 26);

    doc.save(`Astro_Analyse_${formData.name || 'Studio'}.pdf`);
  };

  const renderFormattedText = (rawText) => {
    return rawText.split('\n').map((line, index) => {
      if (line.startsWith('### 1.')) {
        return (
          <div key={index} className="bg-white/[0.01] border border-white/5 rounded-xl p-5 mb-4 mt-2">
            <h4 className="text-base font-serif text-[#d4af37] font-semibold mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#d4af37] text-xl">wb_twilight</span> {line.replace('### 1.', '')}
            </h4>
          </div>
        );
      }
      if (line.startsWith('### 2.')) {
        return (
          <div key={index} className="bg-white/[0.01] border border-white/5 rounded-xl p-5 mb-4">
            <h4 className="text-base font-serif text-[#00f2ff] font-semibold mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00f2ff] text-xl">contrast</span> {line.replace('### 2.', '')}
            </h4>
          </div>
        );
      }
      if (line.startsWith('### 3.')) {
        return (
          <div key={index} className="bg-white/[0.01] border border-white/5 rounded-xl p-5 mb-2">
            <h4 className="text-base font-serif text-slate-200 font-semibold mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-xl">navigation</span> {line.replace('### 3.', '')}
            </h4>
          </div>
        );
      }
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <p key={index} className="text-slate-300 font-light leading-relaxed mb-3 text-[14px]">
            {parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part)}
          </p>
        );
      }
      return line.trim() !== '' ? <p key={index} className="text-slate-300 font-light leading-relaxed mb-3 text-[14px]">{line}</p> : null;
    });
  };

  // Dynamischer SVG-Katalysator (Zeichnet das Radix basierend auf den echten Längen)
  const drawSvgRadix = () => {
    if (!astroData.planets) return null;

    const center = 190;
    const aspectLines = astroData.aspects.map((a, i) => {
      const p1Data = astroData.planets[a.p1];
      const p2Data = astroData.planets[a.p2];
      if (!p1Data || !p2Data) return null;

      const r1 = (p1Data.totalDeg * Math.PI) / 180;
      const r2 = (p2Data.totalDeg * Math.PI) / 180;
      return (
        <line key={i} x1={center + 110 * Math.cos(r1)} y1={center + 110 * Math.sin(r1)} x2={center + 110 * Math.cos(r2)} y2={center + 110 * Math.sin(r2)} stroke={a.color} strokeWidth="0.8" strokeDasharray={a.asp === 'Quadrat' ? '3 3' : '0'} />
      );
    });

    const planetMarkers = Object.entries(astroData.planets).map(([name, p]) => {
      const rad = (p.totalDeg * Math.PI) / 180;
      const x = center + 135 * Math.cos(rad);
      const y = center + 135 * Math.sin(rad);
      const glyphs = { Sonne: '☉', Mond: '☽', Merkur: '☿', Venus: '♀', Mars: '♂', Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptun: '♆', Pluto: '♇', Mondknoten: '☊' };
      return (
        <g key={name}>
          <circle cx={x} cy={y} r="4" fill="#05070a" stroke="#d4af37" strokeWidth="1" />
          <text x={x + 6} y={y + 4} fill="#ffffff" fontSize="13">{glyphs[name] || '•'}</text>
        </g>
      );
    });

    return (
      <svg viewBox="0 0 380 380" className="w-full h-full">
        <circle cx="190" cy="190" r="160" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx="190" cy="190" r="130" fill="none" stroke="#d4af37" strokeWidth="1.5" opacity="0.3" />
        <circle cx="190" cy="190" r="110" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        {aspectLines}
        {planetMarkers}
        <circle cx="190" cy="190" r="5" fill="#d4af37" />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-200 flex flex-col items-center py-12 px-4 selection:bg-[#d4af37]/30">
      <header className="text-center max-w-2xl mb-12">
        <div className="flex justify-center mb-4 text-[#d4af37]">
          <Compass size={56} className="animate-spin" style={{ animationDuration: '20s' }} />
        </div>
        <h1 className="text-4xl md:text-5xl font-serif text-white font-bold tracking-wider uppercase">Astro-Kosmo-Studio</h1>
        <p className="text-slate-400 mt-3 font-light text-base">Psychologische Charakter-Synthese</p>
      </header>

      <main className="w-full max-w-6xl grid lg:grid-cols-12 gap-8 items-start">
        {/* INPUT TILE */}
        <div className="lg:col-span-5 bg-[#0b0e14]/80 backdrop-blur-md border border-slate-800/60 p-6 md:p-8 rounded-2xl shadow-2xl">
          <h2 className="text-xl font-serif text-[#00f2ff] mb-6 border-b border-slate-800 pb-3 flex items-center gap-2">
            <Moon size={20} /> Geburtskoordinaten
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5"><User size={12} className="inline mr-1"/> Name / Alias</label>
              <input type="text" placeholder="z.B. Alexandra" className="input-dark w-full rounded-md px-4 py-3 text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5"><Calendar size={12} className="inline mr-1"/> Geburtsdatum</label>
                <input type="date" required className="input-dark w-full rounded-md px-4 py-3 text-white" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5"><Clock size={12} className="inline mr-1"/> Uhrzeit</label>
                <input type="time" required className="input-dark w-full rounded-md px-4 py-3 text-white" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5"><MapPin size={12} className="inline mr-1"/> Geburtsort</label>
              <input type="text" required placeholder="Stadt eingeben..." className="input-dark w-full rounded-md px-4 py-3 text-white" value={formData.place} onChange={e => setFormData({...formData, place: e.target.value})} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Identifikations-Rhythmus</label>
              <div className="grid grid-cols-3 gap-3">
                {['weiblich', 'männlich', 'divers'].map((g) => (
                  <button key={g} type="button" onClick={() => setFormData({...formData, gender: g})} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition duration-200 ${formData.gender === g ? 'border-[#d4af37] bg-[#d4af37]/5 text-white shadow-lg' : 'border-slate-800 bg-black/40 text-slate-400'}`}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider">{g === 'weiblich' ? 'Sie' : g === 'männlich' ? 'Er' : 'Divers'}</span>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full mt-4 bg-gradient-to-r from-[#2c1654] to-[#d4af37] text-white py-3.5 rounded-xl font-medium flex justify-center items-center gap-2 text-sm uppercase tracking-wider">
              <Sparkles size={16} /> {isLoading ? "Analysiere Vektoren..." : "Analyse berechnen"}
            </button>
          </form>
        </div>

        {/* OUTPUT BLOCK */}
        <div className="lg:col-span-7 bg-[#0b0e14]/80 backdrop-blur-md border border-slate-800/60 p-6 md:p-8 rounded-2xl shadow-2xl flex flex-col justify-between min-h-[580px]">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-6">
              <h2 className="text-xl font-serif text-[#d4af37] flex items-center gap-2">
                <FileText size={20} /> Kosmische Synthese
              </h2>
              {astroData.planets && (
                <div className="flex gap-2 text-xs uppercase tracking-wider font-semibold">
                  <button onClick={() => setActiveTab('textTab')} className={`px-3 py-1.5 ${activeTab === 'textTab' ? 'border-b-2 border-[#00f2ff] text-white' : 'text-slate-500'}`}>Analyse</button>
                  <button onClick={() => setActiveTab('chartTab')} className={`px-3 py-1.5 ${activeTab === 'chartTab' ? 'border-b-2 border-[#00f2ff] text-white' : 'text-slate-500'}`}>Radix-Rad</button>
                  <button onClick={() => setActiveTab('dataTab')} className={`px-3 py-1.5 ${activeTab === 'dataTab' ? 'border-b-2 border-[#00f2ff] text-white' : 'text-slate-500'}`}>Rohdaten</button>
                </div>
              )}
            </div>

            {activeTab === 'textTab' && (
              <div className="text-slate-300 overflow-y-auto pr-2 max-h-[380px] scrollbar-thin">
                {textOutput ? renderFormattedText(textOutput) : (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20 text-slate-500">
                    <HelpCircle size={40} className="text-slate-700 mb-3" />
                    <p className="max-w-sm text-xs font-light">Warte auf Koordinaten-Eingabe...</p>
                  </div>
                )}
                <div ref={outputEndRef} />
              </div>
            )}

            {activeTab === 'chartTab' && (
              <div className="flex justify-center items-center py-4">
                <div className="w-full max-w-[340px] aspect-square">{drawSvgRadix()}</div>
              </div>
            )}

            {activeTab === 'dataTab' && astroData.planets && (
              <div className="max-h-[380px] overflow-y-auto pr-2 space-y-6 text-xs font-light scrollbar-thin">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(astroData.planets).map(([name, p]) => (
                    <div key={name} className="p-2.5 bg-white/[0.02] border border-white/5 rounded-md flex justify-between">
                      <span className="font-semibold text-slate-200">{name}</span>
                      <span className="text-[#d4af37]">{p.deg.toFixed(2)}° {p.sign} (H{p.house})</span>
                    </div>
                  ))}
                </div>
                {astroData.houses && (
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(astroData.houses).map(([num, h]) => (
                      <div key={num} className="p-2.5 bg-white/[0.02] border border-white/5 rounded-md flex justify-between">
                        <span className="font-semibold text-slate-200">{num}</span>
                        <span className="text-[#00f2ff]">{h.display}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {textOutput && !isLoading && (
            <button onClick={exportToPDF} className="mt-6 w-full border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37] hover:text-black py-3 rounded-xl font-medium text-xs uppercase tracking-wider transition-all duration-300">
              Analyse als Premium-PDF exportieren
            </button>
          )}
        </div>
      </main>

      {/* FOOTER DIALOG INTERACTION */}
      <footer className="w-full py-4 border-t border-white/5 bg-[#0c0e12] flex items-center justify-between px-16 mt-auto hidden md:flex text-xs font-light text-slate-500">
        <div className="font-serif-title font-bold text-[#d4af37] tracking-widest text-sm">ASTRO-KOSMO</div>
        <div className="flex gap-6 uppercase tracking-wider font-semibold">
            <button onClick={() => { setActiveModal('legal'); setLegalType('datenschutz'); }} className="hover:text-[#d4af37]">Datenschutz</button>
            <button onClick={() => { setActiveModal('legal'); setLegalType('impressum'); }} className="hover:text-[#d4af37]">Impressum</button>
            <button onClick={() => { setActiveModal('legal'); setLegalType('kontakt'); }} className="hover:text-[#d4af37]">Fachkontakt</button>
        </div>
      </footer>

      {/* LEGAL MODALS */}
      {activeModal === 'legal' && (
        <div className="fixed inset-0 z-50 bg-[#05070a]/90 backdrop-blur-md flex justify-center items-center p-4">
          <div className="glass-panel max-w-md w-full rounded-xl p-6 relative">
            <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 text-slate-500"><span className="material-symbols-outlined">close</span></button>
            <h3 className="text-xl text-[#d4af37] font-serif mb-4 capitalize">{legalType}</h3>
            <p className="text-xs text-slate-300 font-light leading-relaxed">
              {legalType === 'datenschutz' && "Sämtliche Geburtsdaten verbleiben flüchtig im Sitzungsspeicher."}
              {legalType === 'impressum' && "Verantwortlich: Ass.Prof.Dr. Johannes Klopf, Salzburg."}
              {legalType === 'kontakt' && "Fachlicher Support über das Ärztezentrum Salzburg unter support@wallersee.art."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
