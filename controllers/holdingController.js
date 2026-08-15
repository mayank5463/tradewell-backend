const { HoldingModel } = require("../models/HoldingModel");
const { getLiveQuote } = require("../services/marketQuoteService");

// Merges the DB row (qty, avgPrice — things only a real trade changes) with
// the live quote (ltp, dayChangePercent, name, logoUrl — things that move
// or are only known at quote-time). Without this, the frontend would show
// whatever ltp/day%/logo was true at the moment of the last buy/sell, not
// the actual current price.
function enrichWithLiveQuote(holdingDoc) {
  const holding = holdingDoc.toObject();
  const liveQuote = getLiveQuote(holding.symbol);

  if (!liveQuote) {
    // Market closed / symbol not in watched list yet — serve the last
    // cached values rather than nulling them out.
    return holding;
  }

  const ltp = liveQuote.ltp;
  const netChangePercent = holding.avgPrice
    ? Number((((ltp - holding.avgPrice) / holding.avgPrice) * 100).toFixed(2))
    : holding.netChangePercent;

  return {
    ...holding,
    name: liveQuote.name || holding.name,
    logoUrl: liveQuote.logoUrl || holding.logoUrl,
    instrumentToken: liveQuote.instrumentToken || holding.instrumentToken,
    ltp,
    dayChangePercent: liveQuote.dayChangePercent,
    netChangePercent,
    isLoss: ltp < holding.avgPrice,
  };
}

// ── GET /allholdings ─────────────────────────────────────────────────────
async function getAllHoldings(req, res) {
  try {
    console.log("[HOLDINGS] Fetching for:", req.user?.email);
    // scoped to the logged-in user — this is the key multi-tenancy fix
    const data = await HoldingModel.find({ userId: req.user.id });
    const enriched = data.map(enrichWithLiveQuote);
    console.log("[HOLDINGS] Found", enriched.length, "holdings");
    return res.json(enriched);
  } catch (err) {
    console.error("[HOLDINGS] ❌ Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch holdings." });
  }
}

module.exports = { getAllHoldings };