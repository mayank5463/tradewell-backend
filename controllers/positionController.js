const { PositionModel } = require("../models/PositionModel");
const { getLiveQuote } = require("../services/marketQuoteService");

// Same enrichment logic as holdingController — DB holds qty/avgPrice
// (only a real trade changes these), live quote supplies ltp/dayChangePercent/
// logoUrl (moves or resolves every poll tick).
function enrichWithLiveQuote(positionDoc) {
  const position = positionDoc.toObject();
  const liveQuote = getLiveQuote(position.symbol);

  if (!liveQuote) {
    return position;
  }

  const ltp = liveQuote.ltp;
  const netChangePercent = position.avgPrice
    ? Number((((ltp - position.avgPrice) / position.avgPrice) * 100).toFixed(2))
    : position.netChangePercent;

  return {
    ...position,
    name: liveQuote.name || position.name,
    logoUrl: liveQuote.logoUrl || position.logoUrl,
    instrumentToken: liveQuote.instrumentToken || position.instrumentToken,
    ltp,
    dayChangePercent: liveQuote.dayChangePercent,
    netChangePercent,
    isLoss: ltp < position.avgPrice,
  };
}

// ── GET /allpositions ────────────────────────────────────────────────────
async function getAllPositions(req, res) {
  try {
    console.log("[POSITIONS] Fetching for:", req.user?.email);
    const data = await PositionModel.find({ userId: req.user.id });
    const enriched = data.map(enrichWithLiveQuote);
    console.log("[POSITIONS] Found", enriched.length, "positions");
    return res.json(enriched);
  } catch (err) {
    console.error("[POSITIONS] ❌ Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch positions." });
  }
}

module.exports = { getAllPositions };