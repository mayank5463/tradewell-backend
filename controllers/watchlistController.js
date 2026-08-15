const {
  getWatchlist,
  createList,
  renameList,
  deleteList,
  setActiveList,
  addStockToList,
  removeStockFromList,
} = require("../services/watchlistService");

function handle(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req);
      return res.json(result);
    } catch (err) {
      console.error("[WATCHLIST] ❌", err.message);
      return res.status(err.statusCode || 500).json({ message: err.message || "Watchlist request failed." });
    }
  };
}

module.exports = {
  getMyWatchlist: handle((req) => getWatchlist(req.user.id)),
  createMyList: handle((req) => createList(req.user.id, req.body.name)),
  renameMyList: handle((req) => renameList(req.user.id, req.params.listId, req.body.name)),
  deleteMyList: handle((req) => deleteList(req.user.id, req.params.listId)),
  setMyActiveList: handle((req) => setActiveList(req.user.id, req.body.listId)),
  addStockToMyList: handle((req) => addStockToList(req.user.id, req.params.listId, req.body.symbol)),
  removeStockFromMyList: handle((req) =>
    removeStockFromList(req.user.id, req.params.listId, req.params.symbol),
  ),
};