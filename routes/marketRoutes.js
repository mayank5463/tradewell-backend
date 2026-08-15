

const express = require("express");
const router = express.Router();

const {
  getAllQuotes,
  getOneQuote,
  getTopGainers,
  getTopLosers,
  getMarketIndices,
  getTopIndexFunds, // NEW
  getPopularStocks,
  getFeaturedStocks,
  getStatus,
} = require("../controllers/marketController");

const {
  getHistory,
  getIntradayHistory,
} = require("../controllers/historicalController");


router.get("/market/quotes", getAllQuotes);
router.get("/market/quote/:symbol", getOneQuote);
router.get("/market/gainers", getTopGainers);
router.get("/market/losers", getTopLosers);
router.get("/market/indices", getMarketIndices);

router.get("/market/index-funds", getTopIndexFunds);
router.get("/market/popular", getPopularStocks);
router.get("/market/featured", getFeaturedStocks);
router.get("/market/status", getStatus);
router.get("/market/history/:symbol", getHistory); 
 
router.get("/market/history/:symbol/intraday", getIntradayHistory);

module.exports = router;

