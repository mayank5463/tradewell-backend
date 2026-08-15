

const UPSTOX_CONFIG = {
  apiKey: process.env.UPSTOX_API_KEY,
  apiSecret: process.env.UPSTOX_API_SECRET,
  analyticsToken: process.env.UPSTOX_ANALYTICS_TOKEN,
};

function assertUpstoxConfigured() {
  const missing = Object.entries({
    UPSTOX_ANALYTICS_TOKEN: UPSTOX_CONFIG.analyticsToken,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error("[UPSTOX CONFIG] ❌ Missing env vars:", missing.join(", "));
    return false;
  }

  if (!UPSTOX_CONFIG.apiKey) {
    console.warn(
      "[UPSTOX CONFIG] ⚠️  UPSTOX_API_KEY not set — fine for now (market data doesn't need it), " +
        "but you'll need it before adding real order placement.",
    );
  }

  return true;
}

module.exports = { UPSTOX_CONFIG, assertUpstoxConfigured };