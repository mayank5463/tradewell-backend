

const https = require("https");

const { UPSTOX_CONFIG } = require("../config/upstoxConfig");
const {
  getInstrumentKey,
  getInstrumentName,
  getInstrumentLogo,
  getAllEquitySymbols, // ADDED
} = require("./instrumentMapService");
const { WATCHED_INDICES, TOP_INDEX_FUNDS } = require("../config/watchedInstruments"); // UPDATED — added TOP_INDEX_FUNDS

const QUOTES_HOST = "api.upstox.com";
const QUOTES_PATH = "/v2/market-quote/quotes";

const CHUNK_SIZE = 500;


const BATCH_DELAY_MS = 150;


const MAX_RETRIES_PER_BATCH = 3;
const RETRY_BASE_DELAY_MS = 500;

let liveCache = {};
let pollTimer = null;
let hasLoggedSampleResponse = false;


const POLL_INTERVAL_MS = 7000;

function getLiveCache() {
  return liveCache;
}

function getLiveQuote(symbol) {
  return liveCache[symbol] || null;
}

function getGainers(limit = 20) {
  return Object.values(liveCache)
    .filter((q) => !WATCHED_INDICES.includes(q.symbol))
    .sort((a, b) => b.dayChangePercent - a.dayChangePercent)
    .slice(0, limit);
}

function getLosers(limit = 20) {
  return Object.values(liveCache)
    .filter((q) => !WATCHED_INDICES.includes(q.symbol))
    .sort((a, b) => a.dayChangePercent - b.dayChangePercent)
    .slice(0, limit);
}

function getIndices() {
  return WATCHED_INDICES.map((symbol) => liveCache[symbol]).filter(Boolean);
}


function getTopIndexFunds() {
  return TOP_INDEX_FUNDS.map((symbol) => liveCache[symbol]).filter(Boolean);
}


function buildKeyMaps() {
  const symbolToKey = {};
  const keyToSymbol = {};

  const indexUniverse = [...new Set([...WATCHED_INDICES, ...TOP_INDEX_FUNDS])];
  const allSymbols = [...getAllEquitySymbols(), ...indexUniverse];

  for (const symbol of allSymbols) {
    const instrumentKey = getInstrumentKey(symbol);
    if (instrumentKey) {
      symbolToKey[symbol] = instrumentKey;
      keyToSymbol[instrumentKey] = symbol;
    }
  }
  return { symbolToKey, keyToSymbol };
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestQuotesBatch(instrumentKeys) {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(instrumentKeys.join(","));
    const options = {
      hostname: QUOTES_HOST,
      path: `${QUOTES_PATH}?instrument_key=${query}`,
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${UPSTOX_CONFIG.analyticsToken}`,
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        if (res.statusCode !== 200) {
          const err = new Error(`Quotes request failed: HTTP ${res.statusCode} — ${body}`);
          err.statusCode = res.statusCode;
          reject(err);
          return;
        }
        try {
          const parsed = JSON.parse(body);
          resolve(parsed?.data || {});
        } catch (err) {
          reject(new Error(`Failed to parse quotes response: ${err.message}`));
        }
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.end();
  });
}


async function fetchQuotesBatchWithRetry(instrumentKeys, batchLabel) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await requestQuotesBatch(instrumentKeys);
    } catch (err) {
      const isRateLimited = err.statusCode === 429;
      attempt += 1;
      if (!isRateLimited || attempt > MAX_RETRIES_PER_BATCH) {
        throw err;
      }
      const delay = RETRY_BASE_DELAY_MS * attempt;
      console.warn(
        `[MARKET POLL] 429 on batch ${batchLabel} — retry ${attempt}/${MAX_RETRIES_PER_BATCH} after ${delay}ms`,
      );
      await sleep(delay);
    }
  }
}

function mapDepthLevel(level) {
  return {
    price: level?.price ?? 0,
    quantity: level?.quantity ?? 0,
    orders: level?.orders ?? 0,
  };
}

function mapQuote(symbol, quoteData) {
  const ohlc = quoteData.ohlc || {};
  const depth = quoteData.depth || {};
  const ltp = quoteData.last_price;
  const netChange = quoteData.net_change ?? null;
  const prevClose =
    ltp != null && netChange != null ? Number((ltp - netChange).toFixed(2)) : null;
  const dayChangePercent =
    prevClose > 0 && netChange != null ? Number(((netChange / prevClose) * 100).toFixed(2)) : 0;

  return {
    symbol,
    name: getInstrumentName(symbol),
    logoUrl: getInstrumentLogo(symbol),
    instrumentToken: quoteData.instrument_token ?? null,

    ltp,
    prevClose,
    netChange,
    dayChangePercent,
    averagePrice: quoteData.average_price ?? null,

    open: ohlc.open ?? null,
    high: ohlc.high ?? null,
    low: ohlc.low ?? null,
    close: ohlc.close ?? null,

    volume: quoteData.volume ?? null,
    oi: quoteData.oi ?? null,
    oiDayHigh: quoteData.oi_day_high ?? null,
    oiDayLow: quoteData.oi_day_low ?? null,

    totalBuyQuantity: quoteData.total_buy_quantity ?? null,
    totalSellQuantity: quoteData.total_sell_quantity ?? null,

    lowerCircuitLimit: quoteData.lower_circuit_limit ?? null,
    upperCircuitLimit: quoteData.upper_circuit_limit ?? null,

    depth: {
      buy: (depth.buy || []).map(mapDepthLevel),
      sell: (depth.sell || []).map(mapDepthLevel),
    },

    lastTradeTime: quoteData.last_trade_time ?? null,
    exchangeTimestamp: quoteData.timestamp ?? null,
    updatedAt: new Date().toISOString(),
  };
}


async function fetchAllQuoteBatches(instrumentKeys) {
  const batches = chunk(instrumentKeys, CHUNK_SIZE);
  const results = [];

  for (let i = 0; i < batches.length; i += 1) {
    const label = `${i + 1}/${batches.length}`;
    try {
      const data = await fetchQuotesBatchWithRetry(batches[i], label);
      results.push(data);
    } catch (err) {
      console.error(`[MARKET POLL] ❌ Batch ${label} failed permanently:`, err.message);
    }

    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}

async function pollOnce() {
  const { symbolToKey, keyToSymbol } = buildKeyMaps();
  const instrumentKeys = Object.values(symbolToKey);

  if (instrumentKeys.length === 0) {
    console.warn("[MARKET POLL] No instrument keys resolved yet — instrument map still loading?");
    return;
  }

  try {
    const batchResults = await fetchAllQuoteBatches(instrumentKeys);
    const quotes = Object.assign({}, ...batchResults);

    if (!hasLoggedSampleResponse) {
      const [sampleKey] = Object.keys(quotes);
      console.log(
        "[MARKET POLL] Sample raw quote response:",
        sampleKey ? JSON.stringify({ [sampleKey]: quotes[sampleKey] }, null, 2) : "(empty)",
      );
      hasLoggedSampleResponse = true;
    }

    let updatedCount = 0;

    for (const quoteData of Object.values(quotes)) {
      const instrumentKey = quoteData?.instrument_token;
      const symbol = keyToSymbol[instrumentKey];
      if (!symbol) continue;

      if (quoteData.last_price == null || quoteData.net_change == null) {
        console.warn(`[MARKET POLL] Skipping ${symbol} — missing last_price or net_change`, {
          rawKeys: Object.keys(quoteData),
        });
        continue;
      }

      liveCache[symbol] = mapQuote(symbol, quoteData);
      updatedCount += 1;
    }

    console.log(
      `[MARKET POLL] ✅ Updated ${updatedCount}/${instrumentKeys.length} symbols across ${chunk(instrumentKeys, CHUNK_SIZE).length} batches`,
    );
  } catch (err) {
    console.error("[MARKET POLL] ❌ Poll failed:", err?.message || err);
  }
}

function startPolling() {
  if (pollTimer) {
    console.log("[MARKET POLL] Already running — ignoring duplicate start.");
    return;
  }
  if (!UPSTOX_CONFIG.analyticsToken) {
    console.error("[MARKET POLL] ❌ UPSTOX_ANALYTICS_TOKEN missing — cannot start polling.");
    return;
  }

  console.log(`[MARKET POLL] Starting — polling every ${POLL_INTERVAL_MS / 1000}s.`);
  pollOnce();
  pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("[MARKET POLL] Stopped.");
  }
}

module.exports = {
  startPolling,
  stopPolling,
  getLiveCache,
  getLiveQuote,
  getGainers,
  getLosers,
  getIndices,
  getTopIndexFunds, // NEW
};