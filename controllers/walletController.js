const { getWallet, getLedger, resetPaperTradingAccount } = require("../services/walletService");

async function getMyWallet(req, res) {
  try {
    const wallet = await getWallet(req.user.id);
    return res.json({
      balance: wallet.balance,
      currency: wallet.currency,
      marginUsed: wallet.marginUsed,
      marginAvailable: wallet.balance - wallet.marginUsed,
    });
  } catch (err) {
    console.error("[WALLET] ❌ getMyWallet error:", err.message);
    return res.status(500).json({ error: "Failed to fetch wallet." });
  }
}

async function getMyLedger(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const before = req.query.before;
    const transactions = await getLedger(req.user.id, { limit, before });
    return res.json({ count: transactions.length, transactions });
  } catch (err) {
    console.error("[WALLET] ❌ getMyLedger error:", err.message);
    return res.status(500).json({ error: "Failed to fetch fund statement." });
  }
}

async function resetMyAccount(req, res) {
  try {
    const wallet = await resetPaperTradingAccount(req.user.id);
    return res.json({
      balance: wallet.balance,
      currency: wallet.currency,
      marginUsed: wallet.marginUsed,
      marginAvailable: wallet.balance - wallet.marginUsed,
    });
  } catch (err) {
    console.error("[WALLET] ❌ resetMyAccount error:", err.message);
    return res.status(500).json({ error: "Failed to reset account." });
  }
}

module.exports = { getMyWallet, getMyLedger, resetMyAccount };