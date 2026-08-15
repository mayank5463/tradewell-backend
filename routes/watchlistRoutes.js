const express = require("express");
const router = express.Router();

const { AuthMiddleware } = require("../middleware/AuthMiddleware");
const {
  getMyWatchlist,
  createMyList,
  renameMyList,
  deleteMyList,
  setMyActiveList,
  addStockToMyList,
  removeStockFromMyList,
} = require("../controllers/watchlistController");

router.get("/watchlist", AuthMiddleware, getMyWatchlist);
router.post("/watchlist/list", AuthMiddleware, createMyList);
router.put("/watchlist/list/:listId", AuthMiddleware, renameMyList);
router.delete("/watchlist/list/:listId", AuthMiddleware, deleteMyList);
router.put("/watchlist/active", AuthMiddleware, setMyActiveList);
router.post("/watchlist/list/:listId/stock", AuthMiddleware, addStockToMyList);
router.delete("/watchlist/list/:listId/stock/:symbol", AuthMiddleware, removeStockFromMyList);

module.exports = router;