const https = require("https");

const { UPSTOX_CONFIG } = require("../config/upstoxConfig");
const { getInstrumentKey } = require("./instrumentMapService");
const HistoricalCandle = require("../models/HistoricalCandle");

const HISTORICAL_HOST = "api.upstox.com";

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function todayDateString() {
  return toDateString(new Date());
}

function fetchCandlesFromUpstox(instrumentKey, unit, interval, toDate, fromDate) {
  return new Promise((resolve, reject) => {
    const encodedKey = encodeURIComponent(instrumentKey);
    const path = `/v3/historical-candle/${encodedKey}/${unit}/${interval}/${toDate}/${fromDate}`;

    console.log(`[HISTORY] → Upstox request: ${path}`);

    const options = {
      hostname: HISTORICAL_HOST,
      path,
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
        console.log(`[HISTORY] ← Upstox response status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          // This is the #1 place a "chart shows nothing" bug shows up —
          // an expired/missing analyticsToken returns 401 here.
          console.error(`[HISTORY] ✗ Non-200 body:`, body.slice(0, 300));
          reject(new Error(`Historical candle request failed: HTTP ${res.statusCode} — ${body}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          const candles = parsed?.data?.candles || [];
          console.log(`[HISTORY] ← Parsed ${candles.length} raw candles from Upstox`);
          resolve(candles);
        } catch (err) {
          reject(new Error(`Failed to parse historical candle response: ${err.message}`));
        }
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.end();
  });
}

async function cacheCandles(symbol, unit, interval, candles) {
  if (candles.length === 0) return;

  const ops = candles.map(([timestamp, open, high, low, close, volume, oi]) => ({
    updateOne: {
      filter: { symbol, unit, interval, timestamp },
      update: { $set: { open, high, low, close, volume, oi } },
      upsert: true,
    },
  }));

  await HistoricalCandle.bulkWrite(ops, { ordered: false });
}

function docToCandle(doc) {
  return {
    timestamp: doc.timestamp,
    open: doc.open,
    high: doc.high,
    low: doc.low,
    close: doc.close,
    volume: doc.volume,
    oi: doc.oi,
  };
}

async function getHistoricalCandles(symbol, { unit = "days", interval = 1, from, to } = {}) {
  const instrumentKey = getInstrumentKey(symbol);
  if (!instrumentKey) {
    // This is the #2 place a "chart shows nothing" bug shows up — symbol
    // not found in the instrument master (wrong symbol name, or the map
    // hasn't finished its first refresh yet on server startup).
    console.error(`[HISTORY] ✗ No instrument_key for "${symbol}" — is this symbol in NSE_EQ?`);
    throw new Error(`No instrument_key found for symbol "${symbol}"`);
  }

  const today = todayDateString();
  const requestedTo = to || today;
  const toDate = requestedTo >= today ? toDateString(new Date(Date.now() - 86400000)) : requestedTo;
  const fromDate = from || toDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const cached = await HistoricalCandle.find({
    symbol,
    unit,
    interval,
    timestamp: { $gte: fromDate, $lte: `${toDate}T23:59:59+05:30` },
  })
    .sort({ timestamp: 1 })
    .lean();

  const coversRange =
    cached.length > 0 &&
    cached[0].timestamp <= `${fromDate}T23:59:59+05:30` &&
    cached[cached.length - 1].timestamp >= `${toDate}T00:00:00+05:30`;

  if (coversRange) {
    console.log(`[HISTORY] Cache hit for ${symbol} (${unit}/${interval}): ${cached.length} candles`);
    return cached.map(docToCandle);
  }

  console.log(`[HISTORY] Cache miss/partial for ${symbol} (${unit}/${interval}) — fetching from Upstox`);
  const rawCandles = await fetchCandlesFromUpstox(instrumentKey, unit, interval, toDate, fromDate);

  if (rawCandles.length === 0) {
    // Not necessarily an error (e.g. a brand-new listing with no history
    // yet in the requested range) — but worth knowing about explicitly
    // instead of silently returning an empty chart.
    console.warn(`[HISTORY] ⚠ Upstox returned 0 candles for ${symbol} in range ${fromDate}..${toDate}`);
  }

  await cacheCandles(symbol, unit, interval, rawCandles);

  const candles = rawCandles.map(([timestamp, open, high, low, close, volume, oi]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    oi,
  }));

  candles.reverse();
  return candles;
}

function buildLiveCandle(symbol) {
  const { getLiveQuote } = require("./marketQuoteService");
  const quote = getLiveQuote(symbol);
  if (!quote) {
    console.warn(`[HISTORY] No live quote available yet for ${symbol} — today's candle will be omitted`);
    return null;
  }

  return {
    timestamp: quote.updatedAt,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    close: quote.ltp,
    volume: quote.volume,
    oi: quote.oi,
    live: true,
  };
}

async function getHistoricalWithLive(symbol, options = {}) {
  const candles = await getHistoricalCandles(symbol, options);

  const unit = options.unit || "days";
  const requestedTo = options.to || todayDateString();
  const includesToday = unit === "days" && requestedTo >= todayDateString();

  if (includesToday) {
    const liveCandle = buildLiveCandle(symbol);
    if (liveCandle) candles.push(liveCandle);
  }

  return candles;
}

// ── ADDED BACK — Intraday Candle Data V3, for the "1D" chart tab ─────────
//
// Different endpoint shape than the historical one above — no date range
// at all, because it only ever returns "today, from market open until
// now":
//   GET /v3/historical-candle/intraday/{instrument_key}/{unit}/{interval}
//
// Same response shape as the historical endpoint though
// ({ data: { candles: [[timestamp, open, high, low, close, volume, oi]] } }),
// so it reuses the same parsing/mapping logic. Deliberately NEVER cached —
// every call needs to reflect the latest forming minute candle.
function fetchIntradayFromUpstox(instrumentKey, unit, interval) {
  return new Promise((resolve, reject) => {
    const encodedKey = encodeURIComponent(instrumentKey);
    const path = `/v3/historical-candle/intraday/${encodedKey}/${unit}/${interval}`;

    console.log(`[INTRADAY] → Upstox request: ${path}`);

    const options = {
      hostname: HISTORICAL_HOST,
      path,
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
        console.log(`[INTRADAY] ← Upstox response status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          console.error(`[INTRADAY] ✗ Non-200 body:`, body.slice(0, 300));
          reject(new Error(`Intraday candle request failed: HTTP ${res.statusCode} — ${body}`));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          const candles = parsed?.data?.candles || [];
          console.log(`[INTRADAY] ← Parsed ${candles.length} raw candles from Upstox`);
          resolve(candles);
        } catch (err) {
          reject(new Error(`Failed to parse intraday candle response: ${err.message}`));
        }
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    req.end();
  });
}

async function getIntradayCandles(symbol, { unit = "minutes", interval = 1 } = {}) {
  const instrumentKey = getInstrumentKey(symbol);
  if (!instrumentKey) {
    console.error(`[INTRADAY] ✗ No instrument_key for "${symbol}" — is this symbol in NSE_EQ?`);
    throw new Error(`No instrument_key found for symbol "${symbol}"`);
  }

  const rawCandles = await fetchIntradayFromUpstox(instrumentKey, unit, interval);

  if (rawCandles.length === 0) {
    console.warn(`[INTRADAY] ⚠ Upstox returned 0 candles for ${symbol} — market likely closed right now`);
  }

  const candles = rawCandles.map(([timestamp, open, high, low, close, volume, oi]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
    oi,
  }));

  candles.reverse();
  return candles;
}

module.exports = { getHistoricalCandles, getHistoricalWithLive, getIntradayCandles };