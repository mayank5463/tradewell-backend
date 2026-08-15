const {
  getHistoricalWithLive,
  getHistoricalCandles,
  getIntradayCandles,
} = require("../services/historicalDataService");

// ── GET /market/history/:symbol ──────────────────────────────────────────
// Query params (all optional):
//   unit      "minutes" | "hours" | "days" | "weeks" | "months"  (default "days")
//   interval  number — how many `unit`s per candle                (default 1)
//   from      "YYYY-MM-DD"                     (default: 30 days before `to`)
//   to        "YYYY-MM-DD"                     (default: today)
//   live      "false" to exclude today's still-forming candle     (default included)
async function getHistory(req, res) {
  const { symbol } = req.params;
  const { unit, interval, from, to, live } = req.query;

  console.log(
    `[HISTORY] GET /market/history/${symbol} — unit=${unit || "days"} interval=${interval || 1} from=${from || "(default)"} to=${to || "(default)"} live=${live !== "false"}`,
  );

  try {
    const options = {
      unit: unit || undefined,
      interval: interval ? Number(interval) : undefined,
      from,
      to,
    };

    const candles =
      live === "false"
        ? await getHistoricalCandles(symbol.toUpperCase(), options)
        : await getHistoricalWithLive(symbol.toUpperCase(), options);

    console.log(`[HISTORY] ✅ Returning ${candles.length} candles for ${symbol.toUpperCase()}`);

    return res.json({
      symbol: symbol.toUpperCase(),
      unit: unit || "days",
      interval: interval ? Number(interval) : 1,
      count: candles.length,
      candles,
    });
  } catch (err) {
    // This is the log line to check if the chart is empty — it will tell
    // you exactly why (missing instrument_key, Upstox auth failure, etc.)
    console.error(`[HISTORY] ❌ Failed for ${symbol}:`, err.message);
    return res.status(400).json({ message: err.message });
  }
}

// ── ADDED BACK — GET /market/history/:symbol/intraday ────────────────────

async function getIntradayHistory(req, res) {
  const { symbol } = req.params;
  const { unit, interval } = req.query;

  console.log(
    `[INTRADAY] GET /market/history/${symbol}/intraday — unit=${unit || "minutes"} interval=${interval || 1}`,
  );

  try {
    const options = {
      unit: unit || undefined,
      interval: interval ? Number(interval) : undefined,
    };

    const candles = await getIntradayCandles(symbol.toUpperCase(), options);

    console.log(`[INTRADAY] ✅ Returning ${candles.length} candles for ${symbol.toUpperCase()}`);

    return res.json({
      symbol: symbol.toUpperCase(),
      unit: unit || "minutes",
      interval: interval ? Number(interval) : 1,
      count: candles.length,
      candles,
    });
  } catch (err) {
    console.error(`[INTRADAY] ❌ Failed for ${symbol}:`, err.message);
    return res.status(400).json({ message: err.message });
  }
}

module.exports = { getHistory, getIntradayHistory };