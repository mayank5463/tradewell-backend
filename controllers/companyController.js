const { getCompanyProfile } = require("../services/companyProfileService");

// GET /market/company/:symbol?force=true
async function getCompany(req, res) {
  const { symbol } = req.params;
  const force = req.query.force === "true";

  console.log(`\n[COMPANY CONTROLLER] Incoming request: GET /market/company/${symbol} (force=${force})`);

  try {
    const profile = await getCompanyProfile(symbol.toUpperCase(), force);
    console.log(`[COMPANY CONTROLLER] ✓ Responding 200 for ${symbol}`);
    return res.json(profile);
  } catch (err) {
    console.error(`[COMPANY CONTROLLER] ✗ Responding 400 for ${symbol}. Reason:`, err.message);
    console.error(`[COMPANY CONTROLLER] Full error stack:`, err.stack);
    return res.status(400).json({ message: err.message });
  }
}

module.exports = { getCompany };