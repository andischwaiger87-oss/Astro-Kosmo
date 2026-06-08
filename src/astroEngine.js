/* AUTO-GENERIERT aus engine-core — validierte Astro-Engine (astronomy-engine). Nicht von Hand editieren ohne engine-core. */
import * as ASTRO from 'astronomy-engine';

/* =========================================================================
   ASTRO-KOSMO Rechen-Engine  —  validierte Ephemeride (astronomy-engine)
   Geozentrisch, tropisch, scheinbare Ekliptiklänge der Epoche (true equinox of date).
   Häuser: echtes Placidus-System mit korrektem Aszendent / MC.
   Verifiziert gegen astro.com / astro-seek (Bogenminuten-Genauigkeit).
   ========================================================================= */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const norm360 = d => ((d % 360) + 360) % 360;
const clampv = (x, a, b) => Math.min(b, Math.max(a, x));

const SIGNS = ["Widder","Stier","Zwillinge","Krebs","Löwe","Jungfrau","Waage","Skorpion","Schütze","Steinbock","Wassermann","Fische"];
const SIGN3 = ["Wid","Sti","Zwi","Kre","Löw","Jun","Waa","Sko","Sch","Ste","Was","Fis"];
const ELEMENT_OF = { "Widder":"Feuer","Löwe":"Feuer","Schütze":"Feuer","Stier":"Erde","Jungfrau":"Erde","Steinbock":"Erde","Zwillinge":"Luft","Waage":"Luft","Wassermann":"Luft","Krebs":"Wasser","Skorpion":"Wasser","Fische":"Wasser" };

function signOf(lon){ return SIGNS[Math.floor(norm360(lon) / 30) % 12]; }
function fmtDMS(lon){
  lon = norm360(lon);
  const s = Math.floor(lon / 30);
  let d = lon - s * 30, deg = Math.floor(d), min = Math.round((d - deg) * 60);
  if (min === 60){ min = 0; deg += 1; }
  return `${deg}° ${SIGN3[s]} ${String(min).padStart(2,'0')}'`;
}

/* ---- Zeitzone: lokale Wanduhrzeit -> UTC, inkl. historischer Sommerzeit (IANA/ICU) ---- */
function zoneOffsetMinutes(zone, utcDate){
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour12:false,
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const p = {}; for (const x of dtf.formatToParts(utcDate)) p[x.type] = x.value;
  const hh = (p.hour === '24') ? '00' : p.hour;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +hh, +p.minute, +p.second);
  return Math.round((asUTC - utcDate.getTime()) / 60000);
}
function wallTimeToUTC(zone, y, mo, d, h, mi){
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  let off = zoneOffsetMinutes(zone, new Date(guess));
  let utc = guess - off * 60000;
  off = zoneOffsetMinutes(zone, new Date(utc));        // an DST-Grenzen nachjustieren
  utc = guess - off * 60000;
  return { date: new Date(utc), offset: off };
}
function zoneFromPlace(place){
  const p = (place || '').toLowerCase();
  if (/deutschland|germany/.test(p)) return 'Europe/Berlin';
  if (/schweiz|switzerland/.test(p)) return 'Europe/Zurich';
  if (/österreich|oesterreich|austria/.test(p)) return 'Europe/Vienna';
  return 'Europe/Vienna'; // Standard (Datensatz überwiegend AT)
}

/* ---- Astronomie ---- */
function obliquityRad(date){
  const t = ASTRO.MakeTime(date).tt / 36525;            // Julian centuries TT von J2000
  const sec = 84381.448 - 46.8150*t - 0.00059*t*t + 0.001813*t*t*t;
  return (sec / 3600) * D2R;
}
function eclipticLongitude(body, date){
  if (body === 'Sun')  return norm360(ASTRO.SunPosition(date).elon);
  if (body === 'Moon') return norm360(ASTRO.EclipticGeoMoon(date).lon);
  const gv  = ASTRO.GeoVector(ASTRO.Body[body], date, true);   // EQJ, mit Aberration
  const rot = ASTRO.Rotation_EQJ_ECT(date);                    // -> wahre Ekliptik der Epoche
  const ev  = ASTRO.RotateVector(rot, gv);
  return norm360(Math.atan2(ev.y, ev.x) * R2D);
}
function trueNorthNode(date){
  const st  = ASTRO.GeoMoonState(date);
  const rot = ASTRO.Rotation_EQJ_ECT(date);
  const r = ASTRO.RotateVector(rot, { x:st.x,  y:st.y,  z:st.z,  t:st.t });
  const v = ASTRO.RotateVector(rot, { x:st.vx, y:st.vy, z:st.vz, t:st.t });
  const hx = r.y*v.z - r.z*v.y, hy = r.z*v.x - r.x*v.z;        // Drehimpuls r x v
  return norm360(Math.atan2(hx, -hy) * R2D);                   // aufsteigender Knoten = z x h
}
function ramcDeg(date, lonEastDeg){
  const gast = ASTRO.SiderealTime(date);                       // Greenwich scheinbare Sternzeit [h]
  return norm360(gast * 15 + lonEastDeg);
}
function lonFromRA(raDeg, eps){
  const r = raDeg * D2R;
  return norm360(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(eps)) * R2D);
}
function ascMc(ramc, eps, latDeg){
  const r = ramc * D2R, ph = latDeg * D2R;
  const mc  = norm360(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(eps)) * R2D);
  const asc = norm360(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(eps) + Math.tan(ph) * Math.sin(eps))) * R2D);
  return { asc, mc };
}
/* Placidus-Zwischenspitzen über Fixpunkt-Iteration auf der Rektaszension */
function placidusCusps(ramc, eps, latDeg){
  const ph = latDeg * D2R;
  function solve(offsetFn){
    let ra = norm360(ramc + 30);
    for (let i = 0; i < 80; i++){
      const lon = lonFromRA(ra, eps);
      const dec = Math.asin(clampv(Math.sin(eps) * Math.sin(lon * D2R), -1, 1));
      const ad  = Math.asin(clampv(Math.tan(ph) * Math.tan(dec), -1, 1)) * R2D;
      const dsa = 90 + ad;
      const next = norm360(ramc + offsetFn(dsa));
      if (Math.abs(((next - ra + 540) % 360) - 180) < 1e-9){ ra = next; break; }
      ra = next;
    }
    return lonFromRA(ra, eps);
  }
  return {
    11: solve(dsa => (1/3) * dsa),
    12: solve(dsa => (2/3) * dsa),
    2:  solve(dsa => (2/3) * dsa + 60),
    3:  solve(dsa => (1/3) * dsa + 120)
  };
}
function houseOfLon(lon, cuspsDeg){
  lon = norm360(lon);
  for (let h = 1; h <= 12; h++){
    const a = cuspsDeg[h], b = cuspsDeg[h === 12 ? 1 : h + 1];
    const inside = a < b ? (lon >= a && lon < b) : (lon >= a || lon < b);
    if (inside) return h;
  }
  return 1;
}

const PLANETS = [
  ['Sonne','Sun'],['Mond','Moon'],['Merkur','Mercury'],['Venus','Venus'],['Mars','Mars'],
  ['Jupiter','Jupiter'],['Saturn','Saturn'],['Uranus','Uranus'],['Neptun','Neptune'],['Pluto','Pluto']
];
const ASPECT_TYPES = [
  { name:"Konjunktion", angle:0,   maxOrb:8, color:"#d4af37" },
  { name:"Sextil",      angle:60,  maxOrb:4, color:"#00e5ff" },
  { name:"Quadrat",     angle:90,  maxOrb:6, color:"#ef4444" },
  { name:"Trigon",      angle:120, maxOrb:6, color:"#00e5ff" },
  { name:"Opposition",  angle:180, maxOrb:8, color:"#ef4444" }
];

function computeChart(payload){
  const [Y, Mo, D] = String(payload.date).split('-').map(Number);
  const [H, Mi] = String(payload.time).split(':').map(Number);
  const lat = (payload.lat !== undefined && payload.lat !== null && payload.lat !== '') ? parseFloat(payload.lat) : 47.8095;
  const lon = (payload.lon !== undefined && payload.lon !== null && payload.lon !== '') ? parseFloat(payload.lon) : 13.0550;
  const zone = payload.zone || zoneFromPlace(payload.place);

  const { date, offset } = wallTimeToUTC(zone, Y, Mo, D, H, Mi);
  const eps  = obliquityRad(date);
  const ramc = ramcDeg(date, lon);
  const { asc, mc } = ascMc(ramc, eps, lat);
  const inter = placidusCusps(ramc, eps, lat);

  const cuspDeg = {
    1: asc, 10: mc, 4: norm360(mc + 180), 7: norm360(asc + 180),
    11: inter[11], 12: inter[12], 2: inter[2], 3: inter[3],
    5: norm360(inter[11] + 180), 6: norm360(inter[12] + 180),
    8: norm360(inter[2] + 180), 9: norm360(inter[3] + 180)
  };

  const houses = {};
  for (let h = 1; h <= 12; h++){
    const deg = cuspDeg[h];
    houses[`Haus ${h}`] = { display: `${Math.floor(norm360(deg) % 30)}° ${SIGN3[Math.floor(norm360(deg)/30)%12]}`, sign: signOf(deg), totalDeg: norm360(deg) };
  }

  const planets = {};
  for (const [de, en] of PLANETS){
    const L = eclipticLongitude(en, date);
    planets[de] = { deg: L % 30, sign: signOf(L), totalDeg: L, house: houseOfLon(L, cuspDeg) };
  }
  const nodeL = trueNorthNode(date);
  planets['Mondknoten'] = { deg: nodeL % 30, sign: signOf(nodeL), totalDeg: nodeL, house: houseOfLon(nodeL, cuspDeg) };

  const elements = { Feuer:0, Erde:0, Luft:0, Wasser:0 };
  for (const [de] of PLANETS) elements[ELEMENT_OF[planets[de].sign]]++;

  const keys = Object.keys(planets);
  const aspects = [];
  for (let i = 0; i < keys.length; i++){
    for (let j = i + 1; j < keys.length; j++){
      const a = planets[keys[i]].totalDeg, b = planets[keys[j]].totalDeg;
      let diff = Math.abs(a - b); if (diff > 180) diff = 360 - diff;
      for (const asp of ASPECT_TYPES){
        const orb = Math.abs(diff - asp.angle);
        if (orb <= asp.maxOrb){
          aspects.push({
            p1: keys[i], asp: asp.name, p2: keys[j],
            orb: `${Math.floor(orb)}°${String(Math.floor((orb % 1) * 60)).padStart(2,'0')}'`,
            color: asp.color, p1Deg: a, p2Deg: b
          });
        }
      }
    }
  }

  return {
    planets, houses, aspects, elements,
    axes: { asc, mc, ascDisplay: fmtDMS(asc), mcDisplay: fmtDMS(mc) },
    meta: { utc: date.toISOString(), offsetMinutes: offset, zone, lat, lon }
  };
}

export { computeChart, fmtDMS, signOf, norm360, zoneFromPlace };
