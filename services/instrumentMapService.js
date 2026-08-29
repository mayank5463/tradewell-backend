const https = require("https");
const zlib = require("zlib");

const INSTRUMENT_MASTER_URL =
  "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz";

let symbolToInstrumentKey = {};
let lastRefreshedAt = null;
let equitySymbols = [];

const INDEX_DEFINITIONS = [
  { key: "NIFTY50", segment: "NSE_INDEX", match: /^nifty\s?50$/i },
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

const NIFTY50_ALIASES = [
  /^nifty\s?50$/i,
  /^nifty$/i,
  /^nifty\s?fifty$/i,
  /^nifty\s?50\s?index$/i,
  /^nse\s?nifty\s?50$/i,
];

function downloadGzip(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { "User-Agent": "Mozilla/5.0 (paper-trading-app)" } },
        (res) => {
          if (res.statusCode !== 200) {
            reject(
              new Error(
                `Instrument master download failed: HTTP ${res.statusCode}`,
              ),
            );
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

function isinFromInstrumentKey(instrumentKey) {
  return instrumentKey?.includes("|") ? instrumentKey.split("|")[1] : null;
}

function buildLogoUrl(instrumentKey) {
  const isin = isinFromInstrumentKey(instrumentKey);
  return isin ? `https://api.elbstream.com/logos/isin/${isin}` : null;
}

async function refreshInstrumentMap() {
  console.log("[INSTRUMENTS] Downloading instrument master...");
  try {
    const gzipped = await downloadGzip(INSTRUMENT_MASTER_URL);
    const jsonText = zlib.gunzipSync(gzipped).toString("utf-8");
    const rows = JSON.parse(jsonText);

    if (!Array.isArray(rows)) {
      throw new Error("Expected a JSON array from the instrument master");
    }

    const map = {};
    const equities = [];

    for (const row of rows) {
      const symbol = row.trading_symbol || row.tradingsymbol || row.symbol;
      const rowName = row.name || "";

      // NSE Equity stocks
      if (row.segment === "NSE_EQ" && symbol) {
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

      // NIFTY50 special handling
      if (
        row.segment === "NSE_INDEX" &&
        NIFTY50_ALIASES.some((re) => re.test(rowName))
      ) {
        if (!map["NIFTY50"]) {
          map["NIFTY50"] = {
            instrumentKey: row.instrument_key,
            name: row.name,
            logoUrl: null,
            instrumentType: row.instrument_type,
          };
          console.log(
            `[INSTRUMENTS] ✅ NIFTY50 resolved: "${row.name}" → ${row.instrument_key}`,
          );
        }
      }

      // SENSEX
      if (row.segment === "BSE_INDEX" && /sensex/i.test(rowName)) {
        if (!map["SENSEX"]) {
          map["SENSEX"] = {
            instrumentKey: row.instrument_key,
            name: row.name,
            logoUrl: null,
            instrumentType: row.instrument_type,
          };
          console.log(
            `[INSTRUMENTS] ✅ SENSEX resolved: "${row.name}" → ${row.instrument_key}`,
          );
        }
      }

      // Other indices
      for (const def of INDEX_DEFINITIONS) {
        if (def.key === "NIFTY50" || def.key === "SENSEX") continue;
        if (row.segment === def.segment && def.match.test(rowName)) {
          if (!map[def.key]) {
            map[def.key] = {
              instrumentKey: row.instrument_key,
              name: row.name,
              logoUrl: null,
              instrumentType: row.instrument_type,
            };
          }
        }
      }
    }

    symbolToInstrumentKey = map;
    equitySymbols = equities;
    lastRefreshedAt = new Date();

    console.log(`[INSTRUMENTS] ✅ Loaded ${Object.keys(map).length} symbols`);
    console.log(`[INSTRUMENTS] ✅ ${equities.length} tradable equities`);
    console.log(
      "[INSTRUMENTS] Index check —",
      INDEX_DEFINITIONS.map(
        (d) => `${d.key}: ${map[d.key]?.instrumentKey || "NOT FOUND"}`,
      ).join(" | "),
    );
  } catch (err) {
    console.error("[INSTRUMENTS] ❌ Refresh failed:", err.message);
  }
}

function getInstrumentKey(symbol) {
  const entry = symbolToInstrumentKey[symbol];
  if (!entry) {
    console.warn(
      `[INSTRUMENTS] No instrument_key found for symbol "${symbol}"`,
    );
  }
  return entry ? entry.instrumentKey : null;
}

function getInstrumentName(symbol) {
  return symbolToInstrumentKey[symbol]?.name || symbol;
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

async function scheduleInstrumentRefresh() {
  await refreshInstrumentMap();
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
