var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../.wrangler/tmp/bundle-2AmuMc/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// api/generate.js
async function onRequestPost(context) {
  try {
    const { date, time, place, gender, name, lat, lon } = await context.request.json();
    const apiKey = context.env.OPENAI_API_KEY;
    if (!date || !time || !place) {
      return new Response(JSON.stringify({ error: "Unvollst\xE4ndige Geburtskoordinaten \xFCbermittelt." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const clientName = name || "Klient/in";
    const prSubjekt = gender === "weiblich" ? "Sie" : gender === "m\xE4nnlich" ? "Er" : "Diese Pers\xF6nlichkeit";
    const prBesitz = gender === "weiblich" ? "ihre" : gender === "m\xE4nnlich" ? "seine" : "die";
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    let y = year;
    let m = month;
    if (m <= 2) {
      y--;
      m += 12;
    }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const decimalHours = hours + minutes / 60;
    const JD = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + decimalHours / 24 + B - 1524.5;
    const T = (JD - 2451545) / 36525;
    const normalizeDeg = /* @__PURE__ */ __name((deg) => {
      let n = deg % 360;
      if (n < 0)
        n += 360;
      return n;
    }, "normalizeDeg");
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
    const mercuryMaxElongation = 23.44 * Math.sin((200 + T * 149e3) * Math.PI / 180);
    const venusMaxElongation = 46.2 * Math.sin((70 + T * 58e3) * Math.PI / 180);
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
    const signs = ["Widder", "Stier", "Zwillinge", "Krebs", "L\xF6we", "Jungfrau", "Waage", "Skorpion", "Sch\xFCtze", "Steinbock", "Wassermann", "Fische"];
    const planetPositions = {};
    Object.entries(planetData).forEach(([pName, totalDeg]) => {
      const signIndex = Math.floor(totalDeg / 30) % 12;
      planetPositions[pName] = {
        deg: totalDeg % 30,
        sign: signs[signIndex],
        totalDeg
      };
    });
    const GMST = (24110.54841 + 8640184812866e-6 * T) % 86400;
    const activeLon = lon !== void 0 ? parseFloat(lon) : 12.43;
    const activeLat = lat !== void 0 ? parseFloat(lat) : 47.52;
    const localSiderealTime = (GMST + decimalHours * 3600 + activeLon * 240) % 86400;
    const ramc = localSiderealTime / 240 % 360;
    const housePositions = {};
    for (let h = 1; h <= 12; h++) {
      const houseDeg = normalizeDeg(ramc + (h - 1) * 30 + activeLat * 0.15);
      const hSignIndex = Math.floor(houseDeg / 30) % 12;
      housePositions[`Haus ${h}`] = {
        display: `${Math.floor(houseDeg % 30)}\xB0 ${signs[hSignIndex].substring(0, 3)}`,
        sign: signs[hSignIndex],
        totalDeg: houseDeg
      };
    }
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
              p1,
              asp: asp.name,
              p2,
              orb: `${Math.floor(currentOrb)}\xB0${Math.floor(currentOrb % 1 * 60).toString().padStart(2, "0")}'`,
              color: asp.color,
              p1Deg: planetPositions[p1].totalDeg,
              p2Deg: planetPositions[p2].totalDeg
            });
          }
        }
      }
    }
    const elementMapping = { "Widder": "Feuer", "L\xF6we": "Feuer", "Sch\xFCtze": "Feuer", "Stier": "Erde", "Jungfrau": "Erde", "Steinbock": "Erde", "Zwillinge": "Luft", "Waage": "Luft", "Wassermann": "Luft", "Krebs": "Wasser", "Skorpion": "Wasser", "Fische": "Wasser" };
    const elements = { Feuer: 0, Erde: 0, Luft: 0, Wasser: 0 };
    Object.values(planetPositions).forEach((p) => {
      elements[elementMapping[p.sign]]++;
    });
    const aspectString = calculatedAspects.map((a) => `Das ${a.asp} von ${a.p1} zu ${a.p2} (Orbis ${a.orb})`).join(", ");
    const systemPrompt = `Du bist ein tiefenpsychologischer Astrologe und Supervisor mit klinisch-neuropsychologischem Hintergrund.
Deine Aufgabe ist es, ein pr\xE4zises Charakterprofil im anspruchsvollen literarischen Stil von C.G. Jung zu erstellen.
WICHTIG: Arbeite Br\xFCche, unbewusste Konflikte, Quadrate und Schattenthemen schonungslos heraus. Das Leben besteht aus Reibung.
Nutze exakt folgende Abschnitte mit den Tags:
'### 1. Energetische Matrix & Grundstruktur'
'### 2. Psychologische Sollbruchstellen & Schattendynamik'
'### 3. Integrationspfad & Individuation'`;
    const userPrompt = `Analysiere die Radixkonstellation f\xFCr ${clientName} (${gender}):
Dominanz: ${Object.keys(elements).reduce((a, b) => elements[a] > elements[b] ? a : b)}
Aspekte: ${aspectString || "Feine unbewusste Str\xF6mungen"}.`;
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
    const textOutputPayload = `### 1. Energetische Matrix & Grundstruktur
Das mathematische Frequenzbild f\xFCr **${clientName}** zeichnet eine psychische Landschaft von intensiver struktureller Dynamik. Mit einer signifikanten Gewichtung des Elements **${Object.keys(elements).reduce((a, b) => elements[a] > elements[b] ? a : b)}** operiert das Bewusstsein auf einer hochfrequenten Ebene.

${prSubjekt} neigt dazu, die \xE4u\xDFere Realit\xE4t ununterbrochen analytisch zu sezieren, w\xE4hrend unbewusste, archaische Str\xF6mungen zeitgleich nach ungefiltertem Ausdruck verlangen. Diese Polarit\xE4t erzeugt eine permanente Grundspannung im System.

---
### 2. Psychologische Sollbruchstellen & Schattendynamik
In Entsprechung des expliziten klinischen Befunds offenbart die Aspekt-Matrix fundamentale, ungesch\xF6nte Triebkonflikte: ${aspectString || "Akute unbewusste Spannungsfelder"}. Hier liegt die eigentliche Bruchlinie der Pers\xF6nlichkeit.

Es zeigt sich eine neurotische Ambivalenz: Ein brennender Autonomieanspruch kollidiert frontal mit einer tief sitzenden, unbewussten Angst vor Kontrollverlust. Diese Reibung \xE4u\xDFert sich im Alltag oft als pl\xF6tzliche Verhaltens-Widerspr\xFCche oder psychosomatische Blockaden. ${prSubjekt} projiziert innere Zerrissenheit h\xE4ufig auf das Umfeld, um der schmerzhaften Konfrontation mit dem eigenen Schatten auszuweichen. Diese Reibungspunkte sind unnachgiebig und fordern ihren Tribut.

---
### 3. Integrationspfad & Individuation
Der therapeutische Individuationsprozess f\xFCr **${clientName}** verweigert sich jedem billigen Kompromiss. Heilung bedeutet hier nicht das Nivellieren oder Gl\xE4tten dieser Abgr\xFCnde, sondern das Aushalten und Integrieren der inneren Gegens\xE4tze. Erst wenn die Reibung als notwendiges Feuer der Transformation akzeptiert wird, synthetisieren sich Logik und Schatten zu einer unersch\xFCtterlichen, reifen Souver\xE4nit\xE4t.`;
    const encoder = new TextEncoder();
    const tokens = textOutputPayload.split(" ");
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
              elements
            })}

`;
            controller.enqueue(encoder.encode(jsonLine));
            tokenIndex++;
          } else {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            clearInterval(interval);
            controller.close();
          }
        }, 20);
      }
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
__name(onRequestPost, "onRequestPost");

// ../.wrangler/tmp/pages-Pr7buu/functionsRoutes-0.25965526765820757.mjs
var routes = [
  {
    routePath: "/api/generate",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: () => {
            isFailOpen = true;
          }
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-2AmuMc/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-2AmuMc/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.2317626495587939.mjs.map
