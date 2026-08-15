
const {
  getLiveCache,
  getLiveQuote,
  getGainers,
  getLosers,
  getIndices,
  getTopIndexFunds: getTopIndexFundsFromCache, // NEW — renamed on import to avoid colliding with the controller function of the same name below
} = require("../services/marketQuoteService");
const { getMapStatus } = require("../services/instrumentMapService");
const { POPULAR_SYMBOLS, WATCHED_SYMBOLS } = require("../config/watchedInstruments");

// ── GET /market/quotes ───────────────────────────────────────────────────
// Full snapshot of every watched stock — this is what the dashboard's main
// stock grid and search bar will read from once Phase 2 wires the client.
function getAllQuotes(req, res) {
  const cache = getLiveCache();
  return res.json({ count: Object.keys(cache).length, quotes: Object.values(cache) });
}

// ── GET /market/quote/:symbol ────────────────────────────────────────────
function getOneQuote(req, res) {
  const { symbol } = req.params;
  const quote = getLiveQuote(symbol.toUpperCase());

  if (!quote) {
    console.warn(`[MARKET] Quote requested for unknown/unavailable symbol: ${symbol}`);
    return res.status(404).json({ message: `No live data for "${symbol}" yet.` });
  }
  return res.json(quote);
}

// ── GET /market/gainers ──────────────────────────────────────────────────
function getTopGainers(req, res) {
  const limit = Number(req.query.limit) || 20;
  return res.json(getGainers(limit));
}

// ── GET /market/losers ───────────────────────────────────────────────────
function getTopLosers(req, res) {
  const limit = Number(req.query.limit) || 20;
  return res.json(getLosers(limit));
}

// ── GET /market/indices ──────────────────────────────────────────────────
// Sensex + Nifty 50.
function getMarketIndices(req, res) {
  return res.json(getIndices());
}

// ── GET /market/index-funds ──────────────────────────────────────────────
// NEW — the 10-index "Top Index Funds" strip on the Summary page: Sensex,
// Nifty, plus 8 sector indices (Bank/IT/FMCG/Auto/Pharma/Metal/Energy/
// Realty — see TOP_INDEX_FUNDS in config/watchedInstruments.js). Same
// bare-array response shape as getMarketIndices above, and same full
// mapQuote() shape as a stock quote (ltp, netChange, dayChangePercent,
// open/high/low, ...) since marketQuoteService.getTopIndexFunds() reads
// off the same liveCache indices are polled into.
function getTopIndexFunds(req, res) {
  return res.json(getTopIndexFundsFromCache());
}

// ── GET /market/popular ──────────────────────────────────────────────────
function getPopularStocks(req, res) {
  const cache = getLiveCache();
  const popular = POPULAR_SYMBOLS.map((symbol) => cache[symbol]).filter(Boolean);
  return res.json(popular);
}

// ── GET /market/featured ─────────────────────────────────────────────────
// Separate from getPopularStocks on purpose: POPULAR_SYMBOLS is a small
// 15-symbol "featured badge" list (see config/watchedInstruments.js's own
// comment), while WATCHED_SYMBOLS is the ~100-symbol curated liquid-stock
// list — the right size for things like MarqueeStrip.jsx that want a
// substantial but still bounded ticker set, not your full NSE equity
// universe (which is what marketQuoteService.js actually polls now) and
// not just the 15 featured picks either.
function getFeaturedStocks(req, res) {
  const cache = getLiveCache();
  const featured = WATCHED_SYMBOLS.map((symbol) => cache[symbol]).filter(Boolean);
  return res.json(featured);
}

// ── GET /market/status ───────────────────────────────────────────────────
// Debug endpoint — confirms the whole pipeline is alive without touching
// the frontend at all.
function getStatus(req, res) {
  const cache = getLiveCache();
  return res.json({
    instrumentMap: getMapStatus(),
    liveSymbolCount: Object.keys(cache).length,
    sample: Object.values(cache).slice(0, 5),
  });
}

module.exports = {
  getAllQuotes,
  getOneQuote,
  getTopGainers,
  getTopLosers,
  getMarketIndices,
  getTopIndexFunds, // NEW
  getPopularStocks,
  getFeaturedStocks,
  getStatus,
};