
const https = require("https");
const CompanyProfile = require("../models/CompanyProfile");
const {
  getInstrumentLogo,
  getInstrumentName,
} = require("./instrumentMapService");

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours
const INDIANAPI_HOST = "stock.indianapi.in";

function httpsGetJson(path) {
  return new Promise((resolve, reject) => {
    console.log(`[COMPANY] → Requesting: https://${INDIANAPI_HOST}${path}`);
    const options = {
      hostname: INDIANAPI_HOST,
      path,
      method: "GET",
      headers: {
        "x-api-key": process.env.INDIANAPI_KEY,
        Accept: "application/json",
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf-8");
        console.log(`[COMPANY] ← Response status: ${res.statusCode}`);
        if (res.statusCode !== 200) {
          console.error(`[COMPANY] ✗ Non-200 body:`, raw.slice(0, 300));
          reject(
            new Error(
              `IndianAPI request failed: HTTP ${res.statusCode} — ${raw.slice(0, 200)}`,
            ),
          );
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          console.error(`[COMPANY] ✗ JSON parse failed:`, err.message);
          reject(
            new Error(`Failed to parse IndianAPI response: ${err.message}`),
          );
        }
      });
      res.on("error", (err) => {
        console.error(`[COMPANY] ✗ Response stream error:`, err.message);
        reject(err);
      });
    });
    req.on("error", (err) => {
      console.error(`[COMPANY] ✗ Request error (network/DNS):`, err.message);
      reject(err);
    });
    req.end();
  });
}

function isUsableMatch(data) {
  return !!data && !data.error && (data.tickerId || data.companyName);
}

// Builds an ordered, de-duplicated list of search terms to try for a
// symbol, from most-specific to most-generic.
function buildSearchCandidates(symbol) {
  const instrumentName = getInstrumentName(symbol) || symbol;
  const candidates = [];
  const seen = new Set();
  const add = (term) => {
    const trimmed = term?.trim();
    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      candidates.push(trimmed);
    }
  };

  // 1. Instrument name with a trailing " LTD"/" LIMITED" stripped —
  //    "RELIANCE INDUSTRIES LTD" -> "RELIANCE INDUSTRIES"
  add(instrumentName.replace(/\s+(LIMITED|LTD\.?)$/i, ""));

  // 2. Just the first word — "RELIANCE INDUSTRIES LTD" -> "RELIANCE",
  //    matches IndianAPI's own documented example ("Reliance").
  add(instrumentName.split(/\s+/)[0]);

  // 3. The full instrument name, untouched, as a fallback in case
  //    stripping was wrong for this particular symbol.
  add(instrumentName);

  // 4. Last resort — the raw NSE trading symbol itself.
  add(symbol);

  return candidates;
}

async function fetchStockProfile(symbol) {
  if (!process.env.INDIANAPI_KEY) {
    throw new Error("INDIANAPI_KEY is not set in environment variables.");
  }

  const candidates = buildSearchCandidates(symbol);
  console.log(`[COMPANY] Search candidates for ${symbol}:`, candidates);

  let lastRaw = null;
  for (const term of candidates) {
    const path = `/stock?name=${encodeURIComponent(term)}`;
    const data = await httpsGetJson(path);
    lastRaw = data;

    console.log(
      `[COMPANY] Raw /stock response for ${symbol} (tried "${term}"):`,
    );
    console.log(JSON.stringify(data, null, 2).slice(0, 3000));

    if (isUsableMatch(data)) {
      console.log(
        `[COMPANY] ✓ Match found for ${symbol} using search term "${term}"`,
      );
      return data;
    }
    console.warn(
      `[COMPANY] ⚠ No match for ${symbol} using "${term}" — trying next candidate`,
    );
  }

  throw new Error(
    `IndianAPI returned no usable match for ${symbol} after trying: ${candidates.join(" | ")}. Last raw: ${JSON.stringify(lastRaw).slice(0, 200)}`,
  );
}

function normalize(symbol, raw) {
  const currentPrice = raw?.currentPrice || {};

  return {
    symbol,
    tickerId: raw?.tickerId || symbol,
    name: raw?.companyName || getInstrumentName(symbol) || symbol,
    logoUrl: getInstrumentLogo(symbol), // unrelated to IndianAPI — from Upstox's ISIN via instrumentMapService
    industry: raw?.industry || null,

    priceNSE: currentPrice.NSE ?? null,
    priceBSE: currentPrice.BSE ?? null,
    percentChange: raw?.percentChange ?? null,
    high52w: raw?.yearHigh ?? null,
    low52w: raw?.yearLow ?? null,

    companyProfile: raw?.companyProfile || null,
    stockTechnicalData: raw?.stockTechnicalData || null,
    financials: raw?.financials || null,
    keyMetrics: raw?.keyMetrics || null,
    futureExpiryDates: raw?.futureExpiryDates || null,
    futureOverviewData: raw?.futureOverviewData || null,
    initialStockFinancialData: raw?.initialStockFinancialData || null,
    analystView: raw?.analystView || null,
    recosBar: raw?.recosBar || null,
    riskMeter: raw?.riskMeter || null,
    shareholding: raw?.shareholding || null,
    corporateActions: raw?.stockCorporateActionData || null,
    stockDetailsReusableData: raw?.stockDetailsReusableData || null,
    recentNews: raw?.recentNews || [],
  };
}

// A cached doc that's all-null on every substantive field is worthless —
// most likely saved back when the search-term bug above was still active.
// Treat it as NOT fresh regardless of updatedAt, so the next request
// retries against IndianAPI instead of being stuck serving nulls for a
// full 24h TTL cycle.
function looksEmpty(doc) {
  return (
    !doc.industry &&
    doc.priceNSE == null &&
    doc.priceBSE == null &&
    !doc.companyProfile &&
    !doc.financials &&
    !doc.keyMetrics
  );
}

async function getCompanyProfile(symbol, force = false) {
  console.log(
    `\n[COMPANY] ===== getCompanyProfile(${symbol}, force=${force}) =====`,
  );

  const cached = await CompanyProfile.findOne({ symbol }).lean();
  const isFresh =
    cached &&
    Date.now() - new Date(cached.updatedAt).getTime() < STALE_MS &&
    !looksEmpty(cached);

  if (cached && looksEmpty(cached) && !force) {
    console.log(
      `[COMPANY] ⚠ Cached doc for ${symbol} is all-null — treating as stale, refetching.`,
    );
  }

  if (cached && isFresh && !force) {
    if (!cached.logoUrl) {
      const logoUrl = getInstrumentLogo(symbol);
      if (logoUrl) {
        await CompanyProfile.updateOne({ symbol }, { logoUrl });
        cached.logoUrl = logoUrl;
      }
    }
    console.log(`[COMPANY] ✓ Serving from cache for ${symbol}`);
    return cached;
  }

  try {
    const raw = await fetchStockProfile(symbol);
    const normalized = normalize(symbol, raw);

    await CompanyProfile.findOneAndUpdate(
      { symbol },
      { ...normalized, updatedAt: new Date() },
      { upsert: true, new: true },
    );

    console.log(`[COMPANY] ✓ Saved to Mongo cache for ${symbol}`);
    return normalized;
  } catch (err) {
    console.error(
      `[COMPANY] ✗ getCompanyProfile failed for ${symbol}:`,
      err.message,
    );
    if (cached && !looksEmpty(cached)) {
      console.log(
        `[COMPANY] Falling back to stale (but non-empty) cache for ${symbol}`,
      );
      return cached;
    }
    throw err;
  }
}

module.exports = { getCompanyProfile };
