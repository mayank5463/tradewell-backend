
const https = require("https");
const zlib = require("zlib");

const INSTRUMENT_MASTER_URL =
  "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz";

// In-memory cache: { "RELIANCE": { instrumentKey, name, logoUrl, instrumentType }, ... }
let symbolToInstrumentKey = {};
let lastRefreshedAt = null;


let equitySymbols = [];


const INDEX_DEFINITIONS = [

  { key: "SENSEX", segment: "BSE_INDEX", match: /^(s&p\s+)?bse\s*sensex$/i },
  { key: "NIFTYBANK", segment: "NSE_INDEX", match: /^nifty\s?bank$/i },
  { key: "NIFTYIT", segment: "NSE_INDEX", match: /^nifty\s?it$/i },
  { key: "NIFTYFMCG", segment: "NSE_INDEX", match: /^nifty\s?fmcg$/i },
  { key: "NIFTYAUTO", segment: "NSE_INDEX", match: /^nifty\s?auto$/i },
  { key: "NIFTYPHARMA", segment: "NSE_INDEX", match: /^nifty\s?pharma$/i },
  { key: "NIFTYMETAL", segment: "NSE_INDEX", match: /^nifty\s?metal$/i },
  { key: "NIFTYENERGY", segment: "NSE_INDEX", match: /^nifty\s?energy$/i },
  { key: "NIFTYREALTY", segment: "NSE_INDEX", match: /^nifty\s?realty$/i },
];

function downloadGzip(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { "User-Agent": "Mozilla/5.0 (paper-trading-app)" } },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Instrument master download failed: HTTP ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks)));
          res.on("error", reject);
        },
      )
      .on("error", reject);
  });
}

let hasLoggedSample = false;


function isinFromInstrumentKey(instrumentKey) {
  return instrumentKey?.includes("|") ? instrumentKey.split("|")[1] : null;
}

function buildLogoUrl(instrumentKey) {
  const isin = isinFromInstrumentKey(instrumentKey);
  return isin ? `https://api.elbstream.com/logos/isin/${isin}` : null;
}

async function refreshInstrumentMap() {
  console.log("[INSTRUMENTS] Downloading instrument master (JSON)...");
  try {
    const gzipped = await downloadGzip(INSTRUMENT_MASTER_URL);
    const jsonText = zlib.gunzipSync(gzipped).toString("utf-8");
    const rows = JSON.parse(jsonText);

    if (!Array.isArray(rows)) {
      throw new Error("Expected a JSON array from the instrument master — got something else.");
    }

    if (!hasLoggedSample && rows.length > 0) {
      const sampleEq = rows.find((r) => r.segment === "NSE_EQ") || rows[0];
      console.log("[INSTRUMENTS] Sample NSE_EQ record:", JSON.stringify(sampleEq, null, 2));
      hasLoggedSample = true;
    }


    const typeCounts = {};


    const resolvedIndexKeys = new Set();


    const sensexCandidates = [];

    const map = {};
    const equities = [];

    for (const row of rows) {
      const symbol = row.trading_symbol || row.tradingsymbol || row.symbol;

      if (row.segment === "NSE_EQ" && symbol) {
        typeCounts[row.instrument_type] = (typeCounts[row.instrument_type] || 0) + 1;

        map[symbol] = {
          instrumentKey: row.instrument_key,
          name: row.name || symbol,
          logoUrl: buildLogoUrl(row.instrument_key),
          instrumentType: row.instrument_type,
        };


        if (row.instrument_type === "EQ") {
          equities.push(symbol);
        }
      }

      if (row.segment === "BSE_INDEX" && /sensex/i.test(row.name || "")) {
        sensexCandidates.push({ name: row.name, instrumentKey: row.instrument_key });
      }

      for (const def of INDEX_DEFINITIONS) {
        if (row.segment === def.segment && def.match.test(row.name || "")) {
          map[def.key] = {
            instrumentKey: row.instrument_key,
            name: row.name,
            logoUrl: null, // indices don't have ISIN-based logos
            instrumentType: row.instrument_type,
          };
          resolvedIndexKeys.add(def.key);
        }
      }
    }

    symbolToInstrumentKey = map;
    equitySymbols = equities;
    lastRefreshedAt = new Date();

    console.log(
      `[INSTRUMENTS] ✅ Loaded ${Object.keys(map).length} symbols (incl. indices) at`,
      lastRefreshedAt.toLocaleString(),
    );
    console.log(
      "[INSTRUMENTS] NSE_EQ instrument_type breakdown:",
      JSON.stringify(typeCounts),
    );
    console.log(
      `[INSTRUMENTS] ✅ ${equities.length} of those are real tradable equities (instrument_type === "EQ")`,
    );

    const indexReport = INDEX_DEFINITIONS.map(
      (def) => `${def.key}: ${map[def.key]?.instrumentKey || "NOT FOUND"}`,
    ).join(" | ");
    console.log("[INSTRUMENTS] Index check —", indexReport);
    console.log(
      `[INSTRUMENTS] Sensex candidates found (${sensexCandidates.length}):`,
      JSON.stringify(sensexCandidates),
    );
    if (resolvedIndexKeys.size < INDEX_DEFINITIONS.length) {
      const missing = INDEX_DEFINITIONS.filter((d) => !resolvedIndexKeys.has(d.key)).map(
        (d) => d.key,
      );
      console.warn(
        `[INSTRUMENTS] ⚠ ${missing.length} tracked indices not resolved: ${missing.join(", ")} — check the instrument master's exact "name" field for these, the regex above may need adjusting.`,
      );
    }
  } catch (err) {
    console.error("[INSTRUMENTS] ❌ Refresh failed:", err.message);
  }
}

function getInstrumentKey(symbol) {
  const entry = symbolToInstrumentKey[symbol];
  if (!entry) {
    console.warn(`[INSTRUMENTS] No instrument_key found for symbol "${symbol}"`);
  }
  return entry ? entry.instrumentKey : null;
}

function getInstrumentName(symbol) {
  const entry = symbolToInstrumentKey[symbol];
  return entry ? entry.name : symbol;
}

function getInstrumentLogo(symbol) {
  return symbolToInstrumentKey[symbol]?.logoUrl ?? null;
}

function getAllEquitySymbols() {
  return equitySymbols.slice();
}

function getMapStatus() {
  return {
    symbolCount: Object.keys(symbolToInstrumentKey).length,
    equityCount: equitySymbols.length,
    lastRefreshedAt,
  };
}

function scheduleInstrumentRefresh() {
  refreshInstrumentMap();
  setInterval(refreshInstrumentMap, 24 * 60 * 60 * 1000);
}

module.exports = {
  scheduleInstrumentRefresh,
  refreshInstrumentMap,
  getInstrumentKey,
  getInstrumentName,
  getInstrumentLogo,
  getAllEquitySymbols,
  getMapStatus,
};